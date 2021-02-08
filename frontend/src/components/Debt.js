import React from 'react';

var _ = require('lodash');

class Debt extends(React.Component) {
    constructor(props) {
        super(props);
        this.state = {
            debts: [],
            debts_sum: 0.0,
            balance: 0.0,
            balance_currency: null,
        }
    }

    componentDidMount() {
        if (this.props.logged_in) {
            this.setState({displayed_form: ''})
            var uri = process.env.REACT_APP_BACKEND_URI + '/api/debts';
            fetch(uri, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            })
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        this.catchError(res.status);
                        return null;
                    }
                    return res.json()
                })
                .then(json => {
                    this.setState({
                        debts: json.items,
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency'],
                        debts_sum: parseFloat(json.sum).toFixed(2)
                    });
                })
        }
        else {
            this.props.catchError();
        }
    }

    createDebt = (e) => {
        var debt_name = document.getElementById('debt-name-id');
        var debt_value = document.getElementById('debt-value-id');
        var debt_currency = document.getElementById('debt-currency-id');
        debt_currency = debt_currency.options[debt_currency.selectedIndex].dataset.id;
        var debt_end_date = document.getElementById('debt-end-date-id');
        var data = {name: debt_name.value, value: debt_value.value, currency: debt_currency, end_date: debt_end_date.value};
        var uri = process.env.REACT_APP_BACKEND_URI + '/api/debts';
        fetch(uri, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        })
            .then(res => {
                if (res.status === 401) {
                    this.props.catchError(res.status);
                    return
                }
                else if (res.status === 406 || res.status === 500 || res.status === 400) {
                    let mes = document.getElementById('debt-create-message-id');
                    mes.innerHTML = 'Что-то пошло не так';
                    mes.style.display = 'block';
                    mes.style.color = '#fb0000';
                    return null;
                }
                const response = res.json();
                return response;
            })
            .then(json => {
                if (json) {
                    let mes = document.getElementById('debt-create-message-id');
                    mes.innerHTML = 'Платеж создан';
                    mes.style.display = 'block';
                    mes.style.color = '#10a000';
                    debt_name.value = '';
                    debt_value.value = 0.00;
                    debt_end_date.value = '';
                    var debts = this.state.debts;
                    debts = [json.item].concat(debts);
                    this.setState({
                        debts: debts,
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency'],
                        debts_sum: (parseFloat(this.state.debts_sum) + parseFloat(json.rub_value)).toFixed(2)
                    });
                }
            })
    }

    correctDebt = (e) => {
        var debt_id = e.target.dataset.id;
        document.getElementById('debt_' + debt_id).classList.remove('success_update_purchase');
        document.getElementById('debt_' + debt_id).classList.remove('danger_update_purchase');
        var complete_debt = false;
        if (e.target.id.includes('complete-debt-id')) {
            complete_debt = e.target.checked;
        }
        var debt_value = document.getElementById('debt-value-id-' + debt_id);
        var debt_currency = document.getElementById('debt-currency-id' + debt_id);
        debt_currency = debt_currency.options[debt_currency.selectedIndex].dataset.id;
        var debt_end_date = document.getElementById('debt-end-date-id-' + debt_id);
        var data = {complete: complete_debt, value: debt_value.value, currency: debt_currency, id: debt_id, end_date: debt_end_date.value};
        fetch(process.env.REACT_APP_BACKEND_URI + '/api/debts', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        })
            .then(res => {
                if (res.status === 401) {
                    this.props.catchError(res.status);
                    return
                }
                else if (res.status === 406 || res.status === 500 || res.status === 400) {
                    document.getElementById('debt_' + debt_id).classList.add('danger_update_purchase');
                    return null;
                }
                const response = res.json();
                return response;
            })
            .then(json => {
                if (json) {
                    document.getElementById('debt_' + debt_id).classList.add('success_update_purchase');
                    if (complete_debt) {
                        var debts = this.state.debts;
                        debts = debts.filter(p => parseInt(p['id']) !== parseInt(debt_id));
                        this.setState({
                            debts: debts,
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            debts_sum: (parseFloat(this.state.debts_sum) - parseFloat(json.rub_value)).toFixed(2)
                        });
                    }
                    else {
                        this.setState({
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            debts_sum: (parseFloat(this.state.debts_sum) - parseFloat(json.rub_value)).toFixed(2)
                        });
                    }
                }
            })
    }

    renderDebtList() {
        return this.state.debts.map((debt) => {
            var show_value = parseFloat(debt.value).toFixed(2);
            return (
                <div className='purchase_table_row_wrapper' id={'debt_' + debt.id}
                    key={'debt_' + debt.id} data-id={debt.id}>
                    <div className='purchase_chbox_date_wrapper'>
                        <div className='purchase_row_item preschedule_purchase_chbox_wrapper'>
                            <div className='custom_chbox_wrapper'>
                                <input type='checkbox' id={'complete-debt-id-' + debt.id} name={'debt_complete-' + debt.id}
                                    className='complete_purchase_chbox' data-id={debt.id} onChange={this.correctDebt} />
                                <span className='complete_purchase_chbox_span'></span>
                            </div>
                        </div>
                        <div className='purchase_row_item purchase_date_wrapper'>
                            <span className='purchase_date'>{debt.created_at.split('T')[0]}</span>
                            <span className='purchase_time'>{debt.created_at.split('T')[1].split('.')[0]}</span>
                        </div>
                    </div>
                    <div className='purchase_info_wrapper'>
                        <div className='purchase_row_item purchase_name_span_wrapper'>
                            <span className='purchase_name'>{debt.name}</span>
                        </div>
                        <div className='purchase_row_item'>
                            <div className='purchase_value_currency_wrapper'>
                                <div className='purchase_value'>
                                    <input type='number' step='0.01' className='purchase_value exist_purchase_input' id={'debt-value-id-' + debt.id}
                                        data-id={debt.id} defaultValue={show_value} onChange={_.debounce(this.correctDebt,1500)} />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id={'debt-currency-id' + debt.id} className='purchase_currency'>
                                        {this.props.renderCurrencies()}
                                    </select>
                                </div>
                           </div>
                       </div>
                    </div>
                    <div className='purchase_row_item'>
                        <div className='purchase_value'>
                            <input type='date' className='purchase_end_date' id={'debt-end-date-id-' + debt.id}
                                data-id={debt.id} defaultValue={debt.end_date} onChange={_.debounce(this.correctDebt,1500)} />
                        </div>
                    </div>
                </div>
            )
        })
    }

    render () {
        if (this.props.logged_in) {
            return (
                <div className='mainwindow'>
                    <div className='balance_wrapper'>
                        <span>Баланс: </span>
                        <span>{this.state.balance} </span>
                        {this.state.balance_currency
                            ? <span>{this.state.balance_currency}</span>
                            : ''
                        }
                    </div>
                    <div className='prescheduled_purchase_sum_wrapper'>
                        <span>Сумма долга {this.state.debts_sum} rub</span>
                    </div>

                    <div className='page_wrapper'>
                        <div className='create_purchase_wrapper' id='create-debt-wrapper-id'>
                            <div className='purchase_value_label'>
                                Название долга
                            </div>
                            <div className='purchase_value_wrapper'>
                                <input type='text' className='purchase_name' id='debt-name-id' />
                            </div>
                            <div className='purchase_value_label'>
                                Одолженная сумма
                            </div>
                            <div className='purchase_wrapper'>
                                <div className='purchase_value_wrapper'>
                                    <input type='number' step='0.01' className='purchase_value' id='debt-value-id' />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id='debt-currency-id' className='purchase_currency'>
                                        {this.props.renderCurrencies()}
                                    </select>
                                </div>
                            </div>
                            <div className='purchase_value_label'>
                                Дата погашения
                            </div>
                            <div className='purchase_value_wrapper'>
                                <input type='date' className='purchase_end_date' id='debt-end-date-id' />
                            </div>
                            <div className='create_purchase_wrapper'>
                                <div className='create_purchase_btn' id='create-debt-id' onClick={this.createDebt}>
                                    Отправить
                                </div>
                            </div>
                            <div className='purchase_create_message' id='debt-create-message-id'>
                            </div>
                        </div>

                        <div className='purchase_table_wrapper'>
                            <div className='purchase_table'>{this.renderDebtList()}</div>
                        </div>
                    </div>
                </div>
            )
        }
        else {
            return (
                <div>
                </div>
            )
        }
    }
}

export default Debt