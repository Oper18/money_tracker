# coding: utf-8

from database import Model


class User(Model):
    """
        Пользователи
        id = integer, pk
        username = string(128), unique
        email = string(128)
        salt = string(255)
        password = string(255)
        first_name = string(64), default=''
        last_name = string(64), default=''
        timestamps
    """

    __table__ = 'users'
    __fillable__ = ['username', 'email', 'salt', 'password', 'first_name', 'last_name']


class Purchase(Model):
    """
        Траты
        id = integer, pk
        name = string(255)
        description = text, nullable
        value = float
        currency = integer
        complete = boolean, default=false
        creator = integer
        doer = integer, nullable
        loan = integer, nullable
        debt = integer, nullable
        accumulation = integer, nullable
        timestamps
    """

    __table__ = 'purchases'
    __fillable__ = ['name', 'description', 'value', 'currency', 'complete', 'creator', 'doer',
                    'loan', 'debt']


class Accumulation(Model):
    """
        Накопления
        id = integer, pk
        name = string(255), default=''
        value = float
        currency = integer
        accumulation_type = integer, nullable
        closed = boolean, default=false
        timestamps
    """

    __table__ = 'accumulations'
    __fillable__ = ['name', 'value', 'currency', 'substract', 'accumulation_type', 'closed']


class Debt(Model):
    """
        Долги
        id = integer, pk
        name = string(255)
        value = float
        currency = integer
        complete = boolean, default=false
        creator = integer
        end_date = date
        timestamps
    """

    __table__ = 'debts'
    __fillable__ = ['name', 'value', 'currency', 'complete', 'creator', 'end_date']


class DebtPayment(Model):
    """
        Выплаты по долгам
        id = integer, pk
        user = integer
        value = float
        timestamps
    """

    __table__ = 'debt_payments'
    __fillable__ = ['user_id', 'value']


class Currency(Model):
    """
        Список валют
        id = integer, pk
        name = string(64)
        timestamps
    """

    __table__ = 'currencies'
    __fillable__ = ['name']


class AccumulationType(Model):
    """
        Типы накоплений
        id = integer, pk
        name = string(255)
        timestamps
    """

    __table__ = 'accumulation_types'
    __fillable__ = ['name']


class Loan(Model):
    """
        Одолженные суммы
        id = integer, pk
        name = string(255)
        value = float
        currency = integer
        closed = boolean, default=false
        timestamps
    """

    __table__ = 'loans'
    __fillable__ = ['name', 'value', 'currency', 'closed']


class ComingIns(Model):
    """
        Доходы
        id = integer, pk
        name = string(255)
        description = text, nullable
        value = float
        currency = integer
        creator = integer
        loan = integer, nullable
        debt = integer, nullable
        timestamps
    """

    __table__ = 'coming_ins'
    __fillable__ = ['name', 'value', 'currency', 'description', 'creator']


class Balance(Model):
    """
        Балланс
        id = integer, pk
        value = float
        currency = integer
        timestamps
    """

    __table__ = 'balance'
    __fillable__ = ['value', 'currency']
