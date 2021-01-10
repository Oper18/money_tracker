import React from 'react';

class ComingIns extends(React.Component) {
    constructor(props) {
        super(props);
        this.state = {
            coming_ins: [],
            balance: 0.0,
            balance_currency: null,
        }
    }

    componentDidMount() {
        if (this.props.logged_in) {
            this.setState({displayed_form: ''})
            var uri = process.env.REACT_APP_BACKEND_URI + '/api/coming_ins';
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
                        coming_ins: json.items,
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency'],
                    });
                })
        }
        else {
            this.props.catchError();
        }
    }

    createComingIns = (e) => {
        var coming_ins_name = document.getElementById('coming-ins-name-id');
        var coming_ins_value = document.getElementById('coming-ins-value-id');
        var coming_ins_currency = document.getElementById('coming-ins-currency-id');
        coming_ins_currency = coming_ins_currency.options[coming_ins_currency.selectedIndex].dataset.id;
        var data = {name: coming_ins_name.value, value: coming_ins_value.value, currency: coming_ins_currency};
        var uri = process.env.REACT_APP_BACKEND_URI + '/api/coming_ins';
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
                        let mes = document.getElementById('coming-ins-create-message-id');
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
                        let mes = document.getElementById('coming-ins-create-message-id');
                        mes.innerHTML = 'Доход добавлен';
                        mes.style.display = 'block';
                        mes.style.color = '#10a000';
                        coming_ins_name.value = '';
                        coming_ins_value.value = 0.00;
                        var coming_ins = this.state.coming_ins;
                        coming_ins = [json.item].concat(coming_ins);
                        this.setState({
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            coming_ins: coming_ins
                        });
                    }
                })
    }

    renderComingInsList() {
        return this.state.coming_ins.map((coming_in) => {
            return (
                <div className='purchase_table_row_wrapper' id={'coming_in_' + coming_in.id}
                    key={'coming_in_' + coming_in.id} data-id={coming_in.id}>
                    <div className='purchase_row_item purchase_date_wrapper'>
                        <span className='purchase_date'>{coming_in.created_at.split('T')[0]}</span>
                        <span className='purchase_time'>{coming_in.created_at.split('T')[1].split('.')[0]}</span>
                    </div>
                    <div className='purchase_info_wrapper'>
                        <div className='purchase_row_item purchase_name_span_wrapper'>
                            <span className='purchase_name'>{coming_in.name}</span>
                        </div>
                        <div className='purchase_row_item purchase_value_span_wrapper'>
                            <span className='purchase_value_span'>{coming_in.value}</span>
                            <span className='purchase_currency_span'> {coming_in.currency_name}</span>
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

                    <div className='page_wrapper'>
                        <div className='create_coming_ins_wrapper page_coming_ins_form' id='create-coming-ins-wrapper-id'>
                            <div className='purchase_value_label'>
                                Название дохода
                            </div>
                            <div className='purchase_value_wrapper'>
                                <input type='text' className='purchase_name' id='coming-ins-name-id' />
                            </div>
                            <div className='purchase_value_label'>
                                Полученная сумма
                            </div>
                            <div className='purchase_wrapper'>
                                <div className='purchase_value_wrapper'>
                                    <input type='number' step='0.01' className='purchase_value' id='coming-ins-value-id' />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id='coming-ins-currency-id' className='purchase_currency'>
                                        {this.props.renderCurrencies()}
                                    </select>
                                </div>
                            </div>
                                <div className='create_purchase_wrapper'>
                                    <div className='create_purchase_btn' id='create-purchase-id' onClick={this.createComingIns}>
                                        Отправить
                                    </div>
                                </div>
                            <div className='purchase_create_message' id='coming-ins-create-message-id'>
                            </div>
                        </div>

                        <div className='purchase_table_wrapper'>
                            <div className='purchase_table'>{this.renderComingInsList()}</div>
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

export default ComingIns