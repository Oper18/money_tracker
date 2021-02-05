# coding: utf-8

import jwt
import datetime
import json
import hashlib
import calendar
import requests
import uuid

from functools import wraps

from flask import Flask, request, session, redirect

from settings import SERVER_SECRET, MEMCACHED_ACCESS_TOKEN_LIFETIME, MEMCACHED_REFRESH_TOKEN_LIFETIME, \
    LOCAL_SALT, CB_URI_RATES

from models import User, Purchase, Accumulation, Debt, Currency, DebtPayment, AccumulationType, \
    Loan, ComingIns, Balance

app = Flask(__name__)

def check_token(token):
    try:
        token_info = jwt.decode(token, SERVER_SECRET, algorithms=['HS256'])
    except Exception as e:
        app.logger.error('check_token, Decode auth token failed: {}'.format(e))
        return 401, 'wrong token type', None
    else:
        user_info = User.where('id', token_info['user_id']).first()
        if user_info:
            if user_info.password == token_info['password'] and \
                    token_info['expiration_time'] >= datetime.datetime.now().timestamp():
                return 200, 'user authenticated', user_info
            else:
                return 401, 'token expired', None
        else:
            return 401, 'no user', None

def check_auth(func):
    @wraps(func)
    def wrapper():
        header = request.headers.get('Authorization', None)
        if not header:
            app.logger.error('Auth header is None')
            return app_response(data={'response': 'no token'}, status_code=401)
        try:
            user_type, token = header.split(' ')
            code, response, user_info = check_token(token=token)
        except Exception as e:
            app.logger.error('check_auth, Decode auth token failed: {}'.format(e))
            return app_response(data={'response': 'wrong token type'}, status_code=401)
        else:
            if code != 200:
                return app_response(data={'response': response}, status_code=code)
            else:
                return func(code=code, response=response, user_info=user_info)
    return wrapper

def json_converter(p):
    if isinstance(p, datetime.datetime) or isinstance(p, datetime.date):
        return p.isoformat()
    elif isinstance(p, uuid.UUID):
        return p.hex

def app_response(data={}, status_code=200, authenticated=True):
    if authenticated:
        balance = Balance. \
            join(table=Currency.__table__,
                 one='{}.id'.format(Currency.__table__),
                 operator='=',
                 two='{}.currency'.format(Balance.__table__),
                 type='left outer'). \
            group_by(
                '{}.id'.format(Balance.__table__),
                '{}.name'.format(Currency.__table__),
            ). \
            order_by_raw('{}.created_at DESC NULLS LAST'.format(Balance.__table__)). \
            first([
                '{}.*'.format(Balance.__table__),
                '{}.name as currency_name'.format(Currency.__table__),
            ])
        if balance:
            data.update({'balance': {'value': round(balance.value, 2),
                                     'currency': balance.currency_name}})
        else:
            data.update({'balance': {'value': 0.00,
                                     'currency': None}})
    return app.response_class(response=json.dumps(data, default=json_converter),
                              status=status_code,
                              mimetype='application/json')

def replace_balance(value, currency):
    balance = Balance.order_by_raw('created_at DESC NULLS LAST').first()
    if balance:
        Balance.create(value=balance.value + value,
                       currency=currency)
    else:
        Balance.create(value=value,
                       currency=currency)

def replace_value_with_rate(value, current_currency, target_currency):
    rates = requests.get(CB_URI_RATES)
    rates = rates.json()['rates']
    if current_currency == 'rub':
        current_rate = 1
    else:
        current_rate = rates[current_currency.upper()]
    if target_currency == 'rub':
        target_rate = 1
    else:
        target_rate = rates[target_currency.upper()]
    rate = current_rate / target_rate
    value = value / rate
    return round(value, 2)


@app.route('/api', methods=['GET'])
def index():
    print(request.headers)
    return {}

@app.route('/api/auth', methods=['POST'])
def auth():
    body = request.json
    username = body.get('username')
    username = username.strip()
    password = body.get('password')
    password = password.strip()

    user_info = User.where('username', username).or_where('email', username).first()
    if user_info:
        if hashlib.sha3_512(password.encode('utf-8') + user_info.salt.encode('utf-8') + LOCAL_SALT.encode('utf-8')).hexdigest() \
                == user_info.password:
            access_token_exp_date = datetime.datetime.now().timestamp() + MEMCACHED_ACCESS_TOKEN_LIFETIME
            refresh_token_exp_date = datetime.datetime.now().timestamp() + MEMCACHED_REFRESH_TOKEN_LIFETIME
            access_token = jwt.encode({'user_id': user_info.id,
                                       'username': user_info.username,
                                       'password': user_info.password,
                                       'expiration_time': access_token_exp_date},
                                      SERVER_SECRET, algorithm='HS256')
            refresh_token = jwt.encode({'user_id': user_info.id,
                                        'username': user_info.username,
                                        'password': user_info.password,
                                        'expiration_time': refresh_token_exp_date},
                                       SERVER_SECRET, algorithm='HS256')
            return app_response(data={'access_token': access_token, 'refresh_token': refresh_token}, authenticated=False)
    return app_response(data={'response': 'no such username'}, status_code=400, authenticated=False)

@app.route('/api/auth/refresh', methods=['POST'])
def refresh_auth():
    body = request.json
    code, response, user_info = check_token(body.get('refresh_token', None))
    if code == 200:
        access_token_exp_date = datetime.datetime.now().timestamp() + MEMCACHED_ACCESS_TOKEN_LIFETIME
        access_token = jwt.encode({'user_id': user_info.id,
                                   'username': user_info.username,
                                   'password': user_info.password,
                                   'expiration_time': access_token_exp_date},
                                  SERVER_SECRET, algorithm='HS256')
        return app_response(data={'access_token': access_token}, authenticated=False)
    return app_response(data={'response': 'wrong refresh token'}, status_code=401, authenticated=False)

@app.route('/api/account', methods=['GET', 'PUT', 'DELETE'])
@check_auth
def user_account(*args, **kwargs):
    if request.method == 'GET':
        user = kwargs.get('user_info')
        return app_response(data={'user': user.serialize()})
    return app_response(data={})

@app.route('/api/purchase', methods=['GET', 'POST', 'PUT'])
@check_auth
def purchase(*args, **kwargs):
    if request.method == 'GET':
        all_items = request.args.get('all', None)
        completed = request.args.get('completed', None)
        if completed is not None:
            completed = True if completed == 1 or completed == '1' else False
        prescheduled = request.args.get('prescheduled', None)
        if not prescheduled:
            first_day, last_day = calendar.monthrange(datetime.datetime.now().date().year, datetime.datetime.now().date().month)
            first_day = datetime.datetime.now().date().replace(day=1)
            last_day = datetime.datetime.now().date().replace(day=last_day)
            if all_items and completed is None:
                return app_response(data={'items': Purchase. \
                                    where('{}.updated_at'.format(Purchase.__table__), '>=', first_day). \
                                    where('{}.updated_at'.format(Purchase.__table__), '<=', last_day). \
                                    or_where('{}.complete'.format(Purchase.__table__), False). \
                                    join(table=Loan.__table__,
                                         one='{}.id'.format(Loan.__table__),
                                         operator='=',
                                         two='{}.loan'.format(Purchase.__table__),
                                         type='left outer'). \
                                    join(table=Debt.__table__,
                                         one='{}.id'.format(Debt.__table__),
                                         operator='=',
                                         two='{}.debt'.format(Purchase.__table__),
                                         type='left outer'). \
                                    join(table=User.__table__,
                                         one='{}.id'.format(User.__table__),
                                         operator='=',
                                         two='{}.creator'.format(Purchase.__table__),
                                         type='left outer'). \
                                    join(table=Currency.__table__,
                                         one='{}.id'.format(Currency.__table__),
                                         operator='=',
                                         two='{}.currency'.format(Purchase.__table__),
                                         type='left outer'). \
                                    group_by(
                                        '{}.id'.format(Purchase.__table__),
                                        '{}.closed'.format(Loan.__table__),
                                        '{}.complete'.format(Debt.__table__),
                                        '{}.end_date'.format(Debt.__table__),
                                        '{}.name'.format(Currency.__table__),
                                        '{}.first_name'.format(User.__table__),
                                    ). \
                                    order_by_raw('{}.created_at DESC NULLS LAST'.format(Purchase.__table__)). \
                                    get([
                                        '{}.*'.format(Purchase.__table__),
                                        '{}.closed as loan_closed'.format(Loan.__table__),
                                        '{}.complete as debt_complete'.format(Debt.__table__),
                                        '{}.end_date as debt_end_date'.format(Debt.__table__),
                                        '{}.name as currency_name'.format(Currency.__table__),
                                        '{}.first_name as creator_name'.format(User.__table__),
                                    ]). \
                                    serialize()})
            elif all_items and completed is not None:
                return app_response(data={'items': Purchase. \
                                    where('{}.created_at'.format(Purchase.__table__), '>=', first_day). \
                                    where('{}.created_at'.format(Purchase.__table__), '<=', last_day). \
                                    where('{}.complete'.format(Purchase.__table__), completed). \
                                    join(table=Loan.__table__,
                                         one='{}.id'.format(Loan.__table__),
                                         operator='=',
                                         two='{}.loan'.format(Purchase.__table__),
                                         type='left outer'). \
                                    join(table=Debt.__table__,
                                         one='{}.id'.format(Debt.__table__),
                                         operator='=',
                                         two='{}.debt'.format(Purchase.__table__),
                                         type='left outer'). \
                                    join(table=User.__table__,
                                         one='{}.id'.format(User.__table__),
                                         operator='=',
                                         two='{}.creator'.format(Purchase.__table__),
                                         type='left outer'). \
                                    join(table=Currency.__table__,
                                         one='{}.id'.format(Currency.__table__),
                                         operator='=',
                                         two='{}.currency'.format(Purchase.__table__),
                                         type='left outer'). \
                                    group_by(
                                        '{}.id'.format(Purchase.__table__),
                                        '{}.closed'.format(Loan.__table__),
                                        '{}.complete'.format(Debt.__table__),
                                        '{}.end_date'.format(Debt.__table__),
                                        '{}.name'.format(Currency.__table__),
                                        '{}.first_name'.format(User.__table__),
                                    ). \
                                    order_by_raw('{}.created_at DESC NULLS LAST'.format(Purchase.__table__)). \
                                    get([
                                        '{}.*'.format(Purchase.__table__),
                                        '{}.closed as loan_closed'.format(Loan.__table__),
                                        '{}.complete as debt_complete'.format(Debt.__table__),
                                        '{}.end_date as debt_end_date'.format(Debt.__table__),
                                        '{}.name as currency_name'.format(Currency.__table__),
                                        '{}.first_name as creator_name'.format(User.__table__),
                                    ]). \
                                    serialize()})
        else:
            purchases = Purchase. \
                where('{}.complete'.format(Purchase.__table__), False). \
                join(table=Loan.__table__,
                     one='{}.id'.format(Loan.__table__),
                     operator='=',
                     two='{}.loan'.format(Purchase.__table__),
                     type='left outer'). \
                join(table=Debt.__table__,
                     one='{}.id'.format(Debt.__table__),
                     operator='=',
                     two='{}.debt'.format(Purchase.__table__),
                     type='left outer'). \
                join(table=User.__table__,
                     one='{}.id'.format(User.__table__),
                     operator='=',
                     two='{}.creator'.format(Purchase.__table__),
                     type='left outer'). \
                join(table=Currency.__table__,
                     one='{}.id'.format(Currency.__table__),
                     operator='=',
                     two='{}.currency'.format(Purchase.__table__),
                     type='left outer'). \
                group_by(
                    '{}.id'.format(Purchase.__table__),
                    '{}.closed'.format(Loan.__table__),
                    '{}.complete'.format(Debt.__table__),
                    '{}.end_date'.format(Debt.__table__),
                    '{}.name'.format(Currency.__table__),
                    '{}.first_name'.format(User.__table__),
                ). \
                order_by_raw('{}.created_at DESC NULLS LAST'.format(Purchase.__table__)). \
                get([
                    '{}.*'.format(Purchase.__table__),
                    '{}.closed as loan_closed'.format(Loan.__table__),
                    '{}.complete as debt_complete'.format(Debt.__table__),
                    '{}.end_date as debt_end_date'.format(Debt.__table__),
                    '{}.name as currency_name'.format(Currency.__table__),
                    '{}.first_name as creator_name'.format(User.__table__),
                ]). \
                serialize()
            purchases_sum = 0.0
            for p in purchases:
                value = p['value']
                if p['currency_name'] != 'rub':
                    value = replace_value_with_rate(value=value, current_currency=p['currency_name'], target_currency='rub')
                purchases_sum += value
            return app_response(data={'items': purchases, 'sum': purchases_sum})
    elif request.method == 'POST':
        body = request.json
        value = body.get('value', 0.0)
        value = float(value)
        currency = body.get('currency', None)
        if currency is None:
            currency = Currency.where('name', 'rub').first().id
        name = body.get('name', '')
        description = body.get('description', None)
        complete = body.get('complete', False)
        user = kwargs.get('user_info')
        purchase = Purchase.create(name=name,
                                   value=value,
                                   currency=currency,
                                   complete=complete,
                                   creator=user.id,
                                   description=description)
        purchase = purchase.serialize()
        purchase['currency_name'] = Currency.where('id', currency).first().name
        purchase['loan_closed'] = None
        purchase['debt_complete'] = None
        purchase['debt_end_date'] = None
        if complete:
            replace_balance(value=float(value) * (-1), currency=currency)
        if purchase['currency_name'] != 'rub':
            value = replace_value_with_rate(value=float(value), current_currency=purchase['currency_name'], target_currency='rub')
        return app_response(data={'item': purchase, 'rub_value': value})
    elif request.method == 'PUT':
        body = request.json
        purchase_id = body.get('id', None)
        value = body.get('value', None)
        if value is not None:
            value = float(value)
        currency = body.get('currency', None)
        name = body.get('name', None)
        description = body.get('description', None)
        complete = body.get('complete', False)
        user = kwargs.get('user_info')
        if purchase_id:
            purchase = Purchase.where('id', purchase_id).first()
            if purchase and not purchase.complete:
                balance_value = None
                if value is not None and not complete:
                    purchase.value = value
                elif not value and complete:
                    balance_value = purchase.value
                purchase.currency = currency if currency is not None else purchase.currency
                purchase.name = name if name is not None else purchase.name
                purchase.description = description if description is not None else purchase.description
                purchase.complete = complete
                purchase.doer = user.id if complete else 0
                purchase.save()
                purchase = Purchase. \
                    where('{}.id'.format(Purchase.__table__), purchase_id). \
                    join(table=Loan.__table__,
                         one='{}.id'.format(Loan.__table__),
                         operator='=',
                         two='{}.loan'.format(Purchase.__table__),
                         type='left outer'). \
                    join(table=Debt.__table__,
                         one='{}.id'.format(Debt.__table__),
                         operator='=',
                         two='{}.debt'.format(Purchase.__table__),
                         type='left outer'). \
                    join(table=Currency.__table__,
                         one='{}.id'.format(Currency.__table__),
                         operator='=',
                         two='{}.currency'.format(Purchase.__table__),
                         type='left outer'). \
                    group_by(
                        '{}.id'.format(Purchase.__table__),
                        '{}.closed'.format(Loan.__table__),
                        '{}.complete'.format(Debt.__table__),
                        '{}.end_date'.format(Debt.__table__),
                        '{}.name'.format(Currency.__table__),
                    ). \
                    first([
                        '{}.*'.format(Purchase.__table__),
                        '{}.closed as loan_closed'.format(Loan.__table__),
                        '{}.complete as debt_complete'.format(Debt.__table__),
                        '{}.end_date as debt_end_date'.format(Debt.__table__),
                        '{}.name as currency_name'.format(Currency.__table__),
                    ]). \
                    serialize()
                if balance_value and complete:
                    replace_balance(value=float(value) * (-1), currency=currency)
            value = purchase['value']
            if purchase['currency_name'] != 'rub':
                value = replace_value_with_rate(value=float(value), current_currency=purchase['currency_name'], target_currency='rub')
            purchases_sum = 0.0
            for p in Purchase. \
                    where('complete', False). \
                    join(table=Currency.__table__,
                         one='{}.id'.format(Currency.__table__),
                         operator='=',
                         two='{}.currency'.format(Purchase.__table__),
                         type='left outer'). \
                    group_by(
                        '{}.id'.format(Purchase.__table__),
                        '{}.name'.format(Currency.__table__),
                    ). \
                    get([
                        '{}.*'.format(Purchase.__table__),
                        '{}.name as currency_name'.format(Currency.__table__),
                    ]):
                value = p.value
                if p.currency_name != 'rub':
                    value = replace_value_with_rate(value=value, current_currency=p.currency_name, target_currency='rub')
                purchases_sum += value
            return app_response(data={'item': purchase, 'rub_value': value, 'sum': purchases_sum})
        return app_response(data={})

@app.route('/api/debts', methods=['GET', 'POST', 'PUT'])
@check_auth
def debts(*args, **kwargs):
    if request.method == 'GET':
        debts = Debt. \
            where('complete', False). \
            join(table=Currency.__table__,
                 one='{}.id'.format(Currency.__table__),
                 operator='=',
                 two='{}.currency'.format(Debt.__table__),
                 type='left outer'). \
            group_by(
                '{}.id'.format(Debt.__table__),
                '{}.name'.format(Currency.__table__),
            ). \
            order_by_raw('created_at DESC NULLS LAST'). \
            get([
                '{}.*'.format(Debt.__table__),
                '{}.name as currency_name'.format(Currency.__table__),
            ]). \
            serialize()
        debts_sum = 0.0
        for debt in debts:
            value = debt['value']
            if debt['currency_name'] != 'rub':
                value = replace_value_with_rate(value=value, current_currency=debt['currency_name'], target_currency='rub')
            debts_sum += value
        return app_response(data={'items': debts, 'sum': debts_sum})
    elif request.method == 'POST':
        body = request.json
        name = body.get('name', '')
        value = body.get('value', 0.0)
        value = float(value)
        currency = body.get('currency', None)
        if currency is None:
            currency = Currency.where('name', 'rub').first().id
        end_date = body.get('end_date', None)
        if end_date is not None and end_date == '':
            end_date = None
        description = body.get('description', None)
        user = kwargs.get('user_info')
        debt = Debt.create(creator=user.id,
                           value=value,
                           currency=currency,
                           name=name,
                           end_date=end_date)
        purchase = ComingIns.create(name=name,
                                    value=value,
                                    currency=currency,
                                    creator=user.id,
                                    description=description,
                                    debt=debt.id)
        purchase = purchase.serialize()
        purchase['currency_name'] = Currency.where('id', currency).first().name
        purchase['debt_complete'] = False
        purchase['end_date'] = debt.end_date
        replace_balance(value=float(value), currency=currency)
        if purchase['currency_name'] != 'rub':
            value = replace_value_with_rate(value=float(value), current_currency=purchase['currency_name'], target_currency='rub')
        return app_response(data={'item': purchase, 'rub_value': value})
    elif request.method == 'PUT':
        body = request.json
        debt_id = body.get('id', None)
        name = body.get('name', None)
        value = body.get('value', 0.0)
        value = float(value)
        currency = body.get('currency', None)
        if currency is None:
            currency = Currency.where('name', 'rub').first().id
        complete = body.get('complete', False)
        end_date = body.get('end_date', None)
        if end_date is not None and end_date == '':
            end_date = None
        description = body.get('description', None)
        user = kwargs.get('user_info')
        debt = Debt.where('id', debt_id).first()
        if debt and not debt.complete:
            debt_currency = Currency.where('id', debt.currency).first()
            if currency != debt_currency.id:
                body_currency = Currency.where('id', currency).first()
                value = replace_value_with_rate(value=float(value), current_currency=body_currency.name, target_currency=debt_currency.name)
            debt_pay_value = debt.value - value
            if value > 0.0:
                DebtPayment.create(user_id=user.id,
                                   value=debt_pay_value)
                debt.value = value
            if end_date is not None:
                if end_date == '':
                    debt.end_date = None
                else:
                    debt.end_date = end_date
            debt.name = name if name is not None else debt.name
            debt.complete = complete
            debt.save()
            if debt_pay_value > 0.0:
                purchase = Purchase.create(name=debt.name,
                                           value=abs(debt_pay_value),
                                           currency=debt.currency,
                                           complete=True,
                                           creator=user.id,
                                           description=description,
                                           debt=debt.id)
            elif debt_pay_value < 0.0:
                purchase = ComingIns.create(name=debt.name,
                                            value=abs(debt_pay_value),
                                            currency=debt.currency,
                                            creator=user.id,
                                            description=description,
                                            debt=debt.id)
            purchase = purchase.serialize()
            purchase['currency_name'] = Currency.where('id', currency).first().name
            purchase['debt_complete'] = complete
            purchase['debt_end_date'] = debt.end_date
            if debt_pay_value > 0.0:
                replace_balance(value=float(debt_pay_value) * (-1), currency=currency)
            elif debt_pay_value < 0.0:
                replace_balance(value=abs(float(debt_pay_value)), currency=currency)
            if purchase['currency_name'] != 'rub':
                debt_pay_value = replace_value_with_rate(value=float(debt_pay_value), current_currency=purchase['currency_name'], target_currency='rub')
            return app_response(data={'item': purchase, 'rub_value': debt_pay_value})
        return {}

@app.route('/api/accumulation_types', methods=['GET'])
@check_auth
def accumulation_types(*args, **kwargs):
    return app_response(data={'items': AccumulationType.get().serialize()})

@app.route('/api/accumulation', methods=['GET', 'POST', 'PUT'])
@check_auth
def accumulation(*args, **kwargs):
    if request.method == 'GET':
        return app_response(data={
            'items': Accumulation. \
                join(table=AccumulationType.__table__,
                     one='{}.id'.format(AccumulationType.__table__),
                     operator='=',
                     two='{}.accumulation_type'.format(Accumulation.__table__),
                     type='left outer'). \
                join(table=Currency.__table__,
                     one='{}.id'.format(Currency.__table__),
                     operator='=',
                     two='{}.currency'.format(Accumulation.__table__),
                     type='left outer'). \
                group_by(
                '{}.id'.format(AccumulationType.__table__),
                '{}.id'.format(Accumulation.__table__),
                '{}.name'.format(Currency.__table__),
            ). \
                get(
                [
                    '{}.*'.format(Accumulation.__table__),
                    '{}.name as accumulation_type_name'.format(AccumulationType.__table__),
                    '{}.name as currency_name'.format(Currency.__table__),
                ]). \
                serialize(),
            'accumulation_types': [{'value': i['name'],
                                    'label': i['name'],
                                    'customAbbreviation': i['id']} for i in AccumulationType.get(['id', 'name']).serialize()],
        })

    elif request.method == 'POST':
        body = request.json
        name = body.get('name', '')
        value = body.get('value', 0.0)
        value = float(value)
        currency = request.args.get('currency', None)
        if currency is None:
            currency = Currency.where('name', 'rub').first().id
        accumulation_type = body.get('accumulation_type', None)
        description = body.get('description', None)
        user = kwargs.get('user_info')
        if accumulation_type:
            accumulation_type_qs = AccumulationType.where('id', accumulation_type).first() \
                if isinstance(accumulation_type, int) else AccumulationType.where('name', accumulation_type).first()
            if not accumulation_type_qs and isinstance(accumulation_type, str):
                accumulation_type = AccumulationType.create(name=accumulation_type)
                accumulation_type = accumulation_type.id
            elif not accumulation_type_qs and not isinstance(accumulation_type, str):
                accumulation_type = None
            elif accumulation_type_qs:
                accumulation_type = accumulation_type_qs.id
        accumulation = Accumulation.create(name=name,
                                           value=value,
                                           currency=currency,
                                           accumulation_type=accumulation_type)
        purchase = Purchase.create(name=name,
                                   value=value,
                                   currency=currency,
                                   complete=True,
                                   creator=user.id,
                                   description=description,
                                   accumulation=accumulation.id)
        accumulation = accumulation.serialize()
        accumulation['currency_name'] = Currency.where('id', currency).first().name
        accumulation['accumulation_type_name'] = AccumulationType.where('id', accumulation['accumulation_type']).first().name \
            if accumulation['accumulation_type'] else ''
        replace_balance(value=float(value) * (-1), currency=currency)
        if accumulation['currency_name'] != 'rub':
            value = replace_value_with_rate(value=float(value), current_currency=purchase['currency_name'], target_currency='rub')
        return app_response(data={'item': accumulation,
                                  'rub_value': value,
                                  'accumulation_types': [{'value': i['name'],
                                                          'label': i['name'],
                                                          'customAbbreviation': i['id']} for i in AccumulationType.get(['id', 'name']).serialize()]})

    elif request.method == 'PUT':
        body = request.json
        accumulation_id = body.get('id', None)
        value = body.get('value', 0.0)
        value = float(value)
        currency = request.args.get('currency', None)
        if currency is None:
            currency = Currency.where('name', 'rub').first().id
        accumulation_type = body.get('accumulation_type', None)
        description = body.get('description', None)
        closed = body.get('closed', False)
        user = kwargs.get('user_info')
        accumulation = Accumulation.where('id', accumulation_id).first()
        if accumulation and not accumulation.closed:
            accumulation_currency = Currency.where('id', accumulation.currency).first()
            if currency != accumulation_currency.id:
                body_currency = Currency.where('id', currency).first()
                value = replace_value_with_rate(value=float(value), current_currency=body_currency.name, target_currency=accumulation_currency.name)
            accumulation_pay_value = accumulation.value - value
            purchase = None
            if accumulation_pay_value < 0.0:
                purchase = Purchase.create(name=accumulation.name,
                                           value=abs(accumulation_pay_value),
                                           currency=accumulation.currency,
                                           complete=True,
                                           creator=user.id,
                                           description=description,
                                           accumulation=accumulation.id)
            accumulation.value = value
            if value <= 0.0 or closed:
                accumulation.closed = True
            if accumulation_type:
                accumulation_type = AccumulationType.where('name', accumulation_type).first()
                if accumulation_type and accumulation.accumulation_type != accumulation_type.id:
                    accumulation.accumulation_type = accumulation_type.id
                elif not accumulation_type:
                    accumulation_type = AccumulationType.create(name=accumulation_type)
                    accumulation.accumulation_type = accumulation_type.id
            accumulation.save()
            if purchase:
                accumulation = accumulation.serialize()
                accumulation['currency_name'] = Currency.where('id', currency).first().name
                accumulation['accumulation_closed'] = closed
                accumulation['accumulation_type_name'] = AccumulationType.where('id', accumulation['accumulation_type']).first().name \
                    if accumulation['accumulation_type'] else ''
                if accumulation_pay_value > 0:
                    replace_balance(value=float(accumulation_pay_value) * (-1), currency=currency)
                if purchase['currency_name'] != 'rub':
                    accumulation_pay_value = replace_value_with_rate(value=float(accumulation_pay_value), current_currency=purchase['currency_name'], target_currency='rub')
                return app_response(data={'item': accumulation,
                                          'rub_value': accumulation_pay_value,
                                          'accumulation_types': [{'value': i['name'],
                                                                  'label': i['name'],
                                                                  'customAbbreviation': i['id']} for i in AccumulationType.get(['id', 'name']).serialize()]})
        return app_response(data={})

@app.route('/api/loans', methods=['GET', 'POST', 'PUT'])
@check_auth
def loans(*args, **kwargs):
    if request.method == 'GET':
        loans = Loan. \
            where('closed', False). \
            join(table=Currency.__table__,
                 one='{}.id'.format(Currency.__table__),
                 operator='=',
                 two='{}.currency'.format(Loan.__table__),
                 type='left outer'). \
            group_by('{}.id'.format(Loan.__table__),
                     '{}.name'.format(Currency.__table__)). \
            order_by_raw('created_at DESC NULLS LAST'). \
            get(
                [
                    '{}.*'.format(Loan.__table__),
                    '{}.name as currency_name'.format(Currency.__table__)
                ]
            ). \
            serialize()
        loans_sum = 0.0
        for loan in loans:
            value = loan['value']
            if loan['currency_name'] != 'rub':
                value = replace_value_with_rate(value=value, current_currency=loan['currency_name'], target_currency='rub')
            loans_sum += value
        return app_response(data={'items': loans, 'sum': loans_sum})
    elif request.method == 'POST':
        body = request.json
        value = body.get('value', 0.0)
        value = float(value)
        name = body.get('name', '')
        currency = request.args.get('currency', None)
        if currency is None:
            currency = Currency.where('name', 'rub').first().id
        user = kwargs.get('user_info')
        description = body.get('description', None)
        loan = Loan.create(name=name,
                           value=value,
                           currency=currency)
        purchase = Purchase.create(name=name,
                                   value=value,
                                   currency=currency,
                                   complete=True,
                                   creator=user.id,
                                   description=description,
                                   loan=loan.id)
        purchase = purchase.serialize()
        purchase['currency_name'] = Currency.where('id', currency).first().name
        purchase['loan_closed'] = False
        replace_balance(value=float(value) * (-1), currency=currency)
        if purchase['currency_name'] != 'rub':
            value = replace_value_with_rate(value=float(value), current_currency=purchase['currency_name'], target_currency='rub')
        return app_response(data={'item': purchase, 'rub_value': value})
    elif request.method == 'PUT':
        body = request.json
        loan_id = body.get('id', None)
        value = body.get('value', 0.0)
        value = float(value)
        currency = request.args.get('currency', None)
        if currency is None:
            currency = Currency.where('name', 'rub').first().id
        user = kwargs.get('user_info')
        description = body.get('description', None)
        closed = body.get('closed', False)
        loan = Loan.where('id', loan_id).where('closed', False).first()
        if loan:
            purchase = False
            if closed:
                loan_pay_value = loan.value
                loan.value = 0
                loan.closed = True
            else:
                if currency is not None and loan.currency != currency:
                    body_currency = Currency.where('id', currency).first()
                    value = replace_value_with_rate(value=float(value), current_currency=body_currency.name, target_currency=currency.name)
                if value <= 0:
                    loan_pay_value = loan.value
                    loan.value = 0
                    loan.closed = True
                elif value > loan.value:
                    loan_pay_value = value - loan.value
                    loan.value = value
                    purchase = True
                else:
                    loan_pay_value = loan.value - value
                    loan.value = value
            loan.save()
            if purchase:
                coming = Purchase.create(name=loan.name,
                                           value=loan_pay_value,
                                           currency=currency,
                                           complete=True,
                                           creator=user.id,
                                           description=description,
                                           loan=loan.id)
            else:
                coming = ComingIns.create(name=loan.name,
                                          value=loan_pay_value,
                                          currency=currency,
                                          creator=user.id,
                                          description=description)
            coming = coming.serialize()
            coming['currency_name'] = Currency.where('id', currency).first().name
            coming['loan_closed'] = loan.closed
            if purchase:
                replace_balance(value=float(loan_pay_value) * (-1), currency=currency)
            else:
                replace_balance(value=float(loan_pay_value), currency=currency)
            if coming['currency_name'] != 'rub':
                loan_pay_value = replace_value_with_rate(value=float(loan_pay_value), current_currency=coming['currency_name'], target_currency='rub')
            return app_response(data={'item': coming, 'rub_value': loan_pay_value})
        return app_response(data={})

@app.route('/api/currency', methods=['GET'])
@check_auth
def currency_list(*args, **kwargs):
    return app_response(data={'items': Currency.get().serialize()})

@app.route('/api/coming_ins', methods=['GET', 'POST', 'PUT'])
@check_auth
def coming_ins(*args, **kwargs):
    if request.method == 'GET':
        return app_response(data={'items': ComingIns. \
                            join(table=Loan.__table__,
                                 one='{}.id'.format(Loan.__table__),
                                 operator='=',
                                 two='{}.loan'.format(ComingIns.__table__),
                                 type='left outer'). \
                            join(table=Currency.__table__,
                                 one='{}.id'.format(Currency.__table__),
                                 operator='=',
                                 two='{}.currency'.format(ComingIns.__table__),
                                 type='left outer'). \
                            group_by(
                                '{}.id'.format(ComingIns.__table__),
                                '{}.name'.format(Currency.__table__),
                                '{}.closed'.format(Loan.__table__),
                            ). \
                            order_by_raw('{}.created_at DESC NULLS LAST'.format(ComingIns.__table__)). \
                            get([
                                '{}.*'.format(ComingIns.__table__),
                                '{}.name as currency_name'.format(Currency.__table__),
                                '{}.closed as loan_closed'.format(Loan.__table__),
                            ]). \
                            serialize()})
    elif request.method == 'POST':
        body = request.json
        value = body.get('value', 0.0)
        value = float(value)
        currency = body.get('currency', None)
        if currency is None:
            currency = Currency.where('name', 'rub').first().id
        name = body.get('name', '')
        description = body.get('description', None)
        user = kwargs.get('user_info')
        coming = ComingIns.create(name=name,
                                  value=value,
                                  currency=currency,
                                  creator=user.id,
                                  description=description)
        coming = coming.serialize()
        coming['currency_name'] = Currency.where('id', currency).first().name
        coming['loan_closed'] = None
        replace_balance(value=float(value), currency=currency)
        return app_response(data={'item': coming})
    elif request.method == 'PUT':
        body = request.json
        coming_id = body.get('id', None)
        value = body.get('value', None)
        if value is not None:
            value = float(value)
        currency = body.get('currency', None)
        name = body.get('name', None)
        description = body.get('description', None)
        user = kwargs.get('user_info')
        if coming_id:
            coming = ComingIns.where('id', coming_id).first()
            if coming:
                balance_value = None
                if value is not None:
                    balance_value = coming.value - value
                    coming.value = value
                coming.currency = currency if currency is not None else coming.currency
                coming.name = name if name is not None else coming.name
                coming.description = description if description is not None else coming.description
                coming.save()
                coming = ComingIns. \
                    where('id', coming_id). \
                    join(table=Loan.__table__,
                         one='{}.id'.format(Loan.__table__),
                         operator='=',
                         two='{}.loan'.format(ComingIns.__table__),
                         type='left outer'). \
                    join(table=Currency.__table__,
                         one='{}.id'.format(Currency.__table__),
                         operator='=',
                         two='{}.currency'.format(Purchase.__table__),
                         type='left outer'). \
                    group_by(
                        '{}.id'.format(Purchase.__table__),
                        '{}.name'.format(Currency.__table__),
                        '{}.closed'.format(Loan.__table__),
                    ). \
                    first([
                        '{}.*'.format(Purchase.__table__),
                        '{}.name as currency_name'.format(Currency.__table__),
                        '{}.closed as loan_closed'.format(Loan.__table__),
                    ]). \
                    serialize()
                if balance_value:
                    replace_balance(value=float(value) * (-1), currency=currency)
            return app_response(data={'item': coming})
        return app_response(data={})

if __name__ == "__main__":
    app.run(host='0.0.0.0')
