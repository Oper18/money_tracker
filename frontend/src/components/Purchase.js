import React from 'react';

var _ = require('lodash');

class Purchase extends(React.Component) {
    constructor(props) {
        super(props);
        this.state = {
            purchases: [],
            balance: 0.0,
            balance_currency: null,
            prescheduled_purchase_sum: 0.0,
        }
    }

    componentDidMount() {
        if (this.props.logged_in) {
            this.setState({displayed_form: ''})
            var uri = process.env.REACT_APP_BACKEND_URI + '/api/purchase?all=1&completed=1';
            if (this.props.prescheduled) {
                uri = process.env.REACT_APP_BACKEND_URI + '/api/purchase?prescheduled=1';
            }
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
                        purchases: json.items,
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency'],
                        prescheduled_purchase_sum: parseFloat(json.sum).toFixed(2)
                    });
                })
        }
        else {
            this.props.catchError();
        }
    }

    createPurchase = (e) => {
        var purchase_name = document.getElementById('purchase-name-id');
        var purchase_value = document.getElementById('purchase-value-id');
        var purchase_currency = document.getElementById('purchase-currency-id');
        purchase_currency = purchase_currency.options[purchase_currency.selectedIndex].dataset.id;
        var purchase_complete = document.getElementById('complete-purchase-id').checked;
        var data = {name: purchase_name.value, value: purchase_value.value, currency: purchase_currency, complete: purchase_complete};
        var uri = process.env.REACT_APP_BACKEND_URI + '/api/purchase';
        if (document.getElementById('loan-purchase-id').checked) {
            uri = process.env.REACT_APP_BACKEND_URI + '/api/loans';
        }
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
                    let mes = document.getElementById('purchase-create-message-id');
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
                    let mes = document.getElementById('purchase-create-message-id');
                    mes.innerHTML = 'Платеж создан';
                    mes.style.display = 'block';
                    mes.style.color = '#10a000';
                    purchase_name.value = '';
                    purchase_value.value = 0.00;
                    document.getElementById('loan-purchase-id').checked = false;
                    document.getElementById('complete-purchase-id').checked = false;
                    var purchases = this.state.purchases;
                    if (this.props.prescheduled && !purchase_complete) {
                        purchases = [json.item].concat(purchases);
                        this.setState({
                            purchases: purchases,
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            prescheduled_purchase_sum: (parseFloat(this.state.prescheduled_purchase_sum) + parseFloat(json.rub_value)).toFixed(2)
                        });
                    }
                    else if (!this.props.prescheduled && purchase_complete) {
                        purchases = [json.item].concat(purchases);
                        this.setState({
                            purchases: purchases,
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            prescheduled_purchase_sum: (parseFloat(this.state.prescheduled_purchase_sum) + parseFloat(json.rub_value)).toFixed(2)
                        });
                    }
                }
            })
    }

    correctPurchase = (e) => {
        var purchase_id = e.target.dataset.id;
        var complete_purchase = false;
        if (e.target.id.includes('complete-purchase-id')) {
            complete_purchase = e.target.checked;
        }
        var purchase_value = document.getElementById('purchase-value-id-' + purchase_id);
        var purchase_currency = document.getElementById('purchase-currency-id' + purchase_id);
        purchase_currency = purchase_currency.options[purchase_currency.selectedIndex].dataset.id;
        var data = {complete: complete_purchase, value: purchase_value.value, currency: purchase_currency, id: purchase_id};
        fetch(process.env.REACT_APP_BACKEND_URI + '/api/purchase', {
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
                    document.getElementById('purchase_' + purchase_id).classList.add('danger_update_purchase');
                    return null;
                }
                const response = res.json();
                return response;
            })
            .then(json => {
                if (json) {
                    document.getElementById('purchase_' + purchase_id).classList.add('success_update_purchase');
                    if (complete_purchase) {
                        var purchases = this.state.purchases;
                        purchases = purchases.filter(p => parseInt(p['id']) !== parseInt(purchase_id));
                        if (this.props.prescheduled) {
                            this.setState({
                                purchases: purchases,
                                balance: json.balance['value'],
                                balance_currency: json.balance['currency'],
                                prescheduled_purchase_sum: parseFloat(json.sum).toFixed(2)
                            });
                        }
                        else {
                            this.setState({
                                purchases: purchases,
                                balance: json.balance['value'],
                                balance_currency: json.balance['currency'],
                            });
                        }
                    }
                    else {
                        if (this.props.prescheduled) {
                            this.setState({
                                balance: json.balance['value'],
                                balance_currency: json.balance['currency'],
                                prescheduled_purchase_sum: parseFloat(json.sum).toFixed(2)
                            });
                        }
                        else{
                            this.setState({
                                balance: json.balance['value'],
                                balance_currency: json.balance['currency'],
                            });
                        }
                    }
                }
            })
    }

    renderPrescheduledPurchaseList() {
        return this.state.purchases.map((purchase) => {
            return (
                <div className='purchase_table_row_wrapper' id={'purchase_' + purchase.id}
                    key={'purchase_' + purchase.id} data-id={purchase.id}>
                    <div className='purchase_chbox_date_wrapper'>
                        <div className='purchase_row_item preschedule_purchase_chbox_wrapper'>
                            <div className='custom_chbox_wrapper'>
                                <input type='checkbox' id={'complete-purchase-id-' + purchase.id} name={'purchase_complete-' + purchase.id}
                                    className='complete_purchase_chbox' data-id={purchase.id} onChange={this.correctPurchase} />
                                <span className='complete_purchase_chbox_span'></span>
                            </div>
                        </div>
                        <div className='purchase_row_item purchase_date_wrapper'>
                            <span className='purchase_date'>{purchase.created_at.split('T')[0]}</span>
                            <span className='purchase_time'>{purchase.created_at.split('T')[1].split('.')[0]}</span>
                        </div>
                    </div>
                    <div className='purchase_info_wrapper'>
                        <div className='purchase_row_item purchase_name_span_wrapper'>
                            <span className='purchase_name_span'>{purchase.name}</span>
                        </div>
                        <div className='purchase_row_item'>
                            <div className='purchase_value_currency_wrapper'>
                                <div className='purchase_value'>
                                    <input type='number' step='0.01' className='purchase_value exist_purchase_input' id={'purchase-value-id-' + purchase.id}
                                        data-id={purchase.id} defaultValue={purchase.value} onChange={_.debounce(this.correctPurchase, 500)} />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id={'purchase-currency-id' + purchase.id} className='purchase_currency'>
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

    renderPurchaseList() {
        return this.state.purchases.map((purchase) => {
            return (
                <div className='purchase_table_row_wrapper' id={'purchase_' + purchase.id}
                    key={'purchase_' + purchase.id} data-id={purchase.id}>
                    <div className='purchase_row_item purchase_date_wrapper'>
                        <span className='purchase_date'>{purchase.created_at.split('T')[0]}</span>
                        <span className='purchase_time'>{purchase.created_at.split('T')[1].split('.')[0]}</span>
                    </div>
                    <div className='purchase_info_wrapper'>
                        <div className='purchase_row_item purchase_name_span_wrapper'>
                            <span className='purchase_name_span'>{purchase.name}</span>
                        </div>
                        <div className='purchase_row_item purchase_value_span_wrapper'>
                            <span className='purchase_value_span'>{purchase.value}</span>
                            <span className='purchase_currency_span'> {purchase.currency_name}</span>
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
                        {this.props.prescheduled
                            ? <span>Общая сумма {this.state.prescheduled_purchase_sum} rub</span>
                            : ''
                        }
                    </div>

                    <div className='page_wrapper'>
                        <div className='create_purchase_wrapper' id='create-purchase-wrapper-id'>
                            <div className='purchase_value_label'>
                                Название платежа
                            </div>
                            <div className='purchase_value_wrapper'>
                                <input type='text' className='purchase_name' id='purchase-name-id' />
                            </div>
                            <div className='purchase_value_label'>
                                Потраченная сумма
                            </div>
                            <div className='purchase_wrapper'>
                                <div className='purchase_value_wrapper'>
                                    <input type='number' step='0.01' className='purchase_value' id='purchase-value-id' />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id='purchase-currency-id' className='purchase_currency'>
                                        {this.props.renderCurrencies()}
                                    </select>
                                </div>
                            </div>
                            <div className='complete_purchase_wrapper'>
                                <div className='custom_chbox_wrapper'>
                                    <input type='checkbox' id='complete-purchase-id' name='purchase_complete' className='complete_purchase_chbox' />
                                    <span className='complete_purchase_chbox_span'></span>
                                </div>
                                <div className='custom_chbox_text_wrapper'>Выполнен</div>
                            </div>
                            <div className='complete_purchase_wrapper'>
                                <div className='custom_chbox_wrapper'>
                                    <input type='checkbox' id='loan-purchase-id' name='loan_complete' className='complete_purchase_chbox' />
                                    <span className='complete_purchase_chbox_span'></span>
                                </div>
                                <div className='custom_chbox_text_wrapper'>В долг</div>
                            </div>
                            <div className='create_purchase_wrapper'>
                                <div className='create_purchase_btn' id='create-purchase-id' onClick={this.createPurchase}>
                                    Отправить
                                </div>
                            </div>
                            <div className='purchase_create_message' id='purchase-create-message-id'>
                            </div>
                        </div>

                        <div className='purchase_table_wrapper'>
                            {this.props.prescheduled
                                ? <div className='purchase_table'>{this.renderPrescheduledPurchaseList()}</div>
                                : <div className='purchase_table'>{this.renderPurchaseList()}</div>
                            }
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

export default Purchase