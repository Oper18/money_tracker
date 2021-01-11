import React from 'react';

var _ = require('lodash');

class Loan extends(React.Component) {
    constructor(props) {
        super(props);
        this.state = {
            loans: [],
            loans_sum: 0.0,
            balance: 0.0,
            balance_currency: null,
        }
    }

    componentDidMount() {
        if (this.props.logged_in) {
            this.setState({displayed_form: ''})
            var uri = process.env.REACT_APP_BACKEND_URI + '/api/loans';
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
                        loans: json.items,
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency'],
                        loans_sum: parseFloat(json.sum).toFixed(2)
                    });
                })
        }
        else {
            this.props.catchError();
        }
    }

    createLoan = (e) => {
        var loan_name = document.getElementById('loan-name-id');
        var loan_value = document.getElementById('loan-value-id');
        var loan_currency = document.getElementById('loan-currency-id');
        loan_currency = loan_currency.options[loan_currency.selectedIndex].dataset.id;
        var data = {name: loan_name.value, value: loan_value.value, currency: loan_currency};
        var uri = process.env.REACT_APP_BACKEND_URI + '/api/loans';
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
                    let mes = document.getElementById('loan-create-message-id');
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
                    let mes = document.getElementById('loan-create-message-id');
                    mes.innerHTML = 'Платеж создан';
                    mes.style.display = 'block';
                    mes.style.color = '#10a000';
                    loan_name.value = '';
                    loan_value.value = 0.00;
                    var loans = this.state.loans;
                    loans = [json.item].concat(loans);
                    this.setState({
                        loans: loans,
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency'],
                        loans_sum: (parseFloat(this.state.loans_sum) + parseFloat(json.rub_value)).toFixed(2)
                    });
                }
            })
    }

    correctLoan = (e) => {
        var loan_id = e.target.dataset.id;
        document.getElementById('loan_' + loan_id).classList.remove('success_update_purchase');
        document.getElementById('loan_' + loan_id).classList.remove('danger_update_purchase');
        var complete_loan = false;
        if (e.target.id.includes('complete-loan-id')) {
            complete_loan = e.target.checked;
        }
        var loan_value = document.getElementById('loan-value-id-' + loan_id);
        var loan_currency = document.getElementById('loan-currency-id' + loan_id);
        loan_currency = loan_currency.options[loan_currency.selectedIndex].dataset.id;
        var data = {closed: complete_loan, value: loan_value.value, currency: loan_currency, id: loan_id};
        fetch(process.env.REACT_APP_BACKEND_URI + '/api/loans', {
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
                    document.getElementById('loan_' + loan_id).classList.add('danger_update_purchase');
                    return null;
                }
                const response = res.json();
                return response;
            })
            .then(json => {
                if (json) {
                    document.getElementById('loan_' + loan_id).classList.add('success_update_purchase');
                    if (complete_loan) {
                        var loans = this.state.loans;
                        loans = loans.filter(p => parseInt(p['id']) !== parseInt(loan_id));
                        this.setState({
                            loans: loans,
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            loans_sum: (parseFloat(this.state.loans_sum) - parseFloat(json.rub_value)).toFixed(2)
                        });
                    }
                    else {
                        this.setState({
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            loans_sum: (parseFloat(this.state.loans_sum) - parseFloat(json.rub_value)).toFixed(2)
                        });
                    }
                }
            })
    }

    renderLoanList() {
        return this.state.loans.map((loan) => {
            return (
                <div className='purchase_table_row_wrapper' id={'loan_' + loan.id}
                    key={'loan_' + loan.id} data-id={loan.id}>
                    <div className='purchase_chbox_date_wrapper'>
                        <div className='purchase_row_item preschedule_purchase_chbox_wrapper'>
                            <div className='custom_chbox_wrapper'>
                                <input type='checkbox' id={'complete-loan-id-' + loan.id} name={'loan_complete-' + loan.id}
                                    className='complete_purchase_chbox' data-id={loan.id} onChange={this.correctLoan} />
                                <span className='complete_purchase_chbox_span'></span>
                            </div>
                        </div>
                        <div className='purchase_row_item purchase_date_wrapper'>
                            <span className='purchase_date'>{loan.created_at.split('T')[0]}</span>
                            <span className='purchase_time'>{loan.created_at.split('T')[1].split('.')[0]}</span>
                        </div>
                    </div>
                    <div className='purchase_info_wrapper'>
                        <div className='purchase_row_item purchase_name_span_wrapper'>
                            <span className='purchase_name'>{loan.name}</span>
                        </div>
                        <div className='purchase_row_item'>
                            <div className='purchase_value_currency_wrapper'>
                                <div className='purchase_value'>
                                    <input type='number' step='0.01' className='purchase_value exist_purchase_input' id={'loan-value-id-' + loan.id}
                                        data-id={loan.id} defaultValue=parseFloat({loan.value}).toFixed(2) onChange={_.debounce(this.correctLoan,1500)} />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id={'loan-currency-id' + loan.id} className='purchase_currency'>
                                        {this.props.renderCurrencies()}
                                    </select>
                                </div>
                           </div>
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
                        <span>Сумма долга {this.state.loans_sum} rub</span>
                    </div>

                    <div className='page_wrapper'>
                        <div className='create_purchase_wrapper' id='create-loan-wrapper-id'>
                            <div className='purchase_value_label'>
                                Название долга
                            </div>
                            <div className='purchase_value_wrapper'>
                                <input type='text' className='purchase_name' id='loan-name-id' />
                            </div>
                            <div className='purchase_value_label'>
                                Одолженная сумма
                            </div>
                            <div className='purchase_wrapper'>
                                <div className='purchase_value_wrapper'>
                                    <input type='number' step='0.01' className='purchase_value' id='loan-value-id' />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id='loan-currency-id' className='purchase_currency'>
                                        {this.props.renderCurrencies()}
                                    </select>
                                </div>
                            </div>
                            <div className='create_purchase_wrapper'>
                                <div className='create_purchase_btn' id='create-loan-id' onClick={this.createLoan}>
                                    Отправить
                                </div>
                            </div>
                            <div className='purchase_create_message' id='loan-create-message-id'>
                            </div>
                        </div>

                        <div className='purchase_table_wrapper'>
                            <div className='purchase_table'>{this.renderLoanList()}</div>
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

export default Loan