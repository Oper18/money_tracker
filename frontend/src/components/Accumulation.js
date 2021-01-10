import React from 'react';
import CreatableSelect from 'react-select/creatable';

var _ = require('lodash');

class Accumulation extends(React.Component) {
    constructor(props) {
        super(props);
        this.state = {
            accumulations: [],
            accumulations_sum: 0.0,
            balance: 0.0,
            balance_currency: null,
            accumulation_types: [],
            choosen_type: '',
        }
    }

    componentDidMount() {
        if (this.props.logged_in) {
            this.setState({displayed_form: ''})
            var uri = process.env.REACT_APP_BACKEND_URI + '/api/accumulation';
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
                        accumulations: json.items,
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency'],
                        accumulations_sum: parseFloat(json.sum).toFixed(2),
                        accumulation_types: json.accumulation_types,
                    });
                })
        }
        else {
            this.props.catchError();
        }
    }

    createAccumulation = (e) => {
        var accumulation_name = document.getElementById('accumulation-name-id');
        var accumulation_value = document.getElementById('accumulation-value-id');
        var accumulation_currency = document.getElementById('accumulation-currency-id');
        accumulation_currency = accumulation_currency.options[accumulation_currency.selectedIndex].dataset.id;
        var data = {name: accumulation_name.value, value: accumulation_value.value, currency: accumulation_currency, accumulation_type: this.state.choosen_type};
        var uri = process.env.REACT_APP_BACKEND_URI + '/api/accumulation';
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
                    let mes = document.getElementById('accumulation-create-message-id');
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
                    let mes = document.getElementById('accumulation-create-message-id');
                    mes.innerHTML = 'Платеж создан';
                    mes.style.display = 'block';
                    mes.style.color = '#10a000';
                    accumulation_name.value = '';
                    accumulation_value.value = 0.00;
                    var accumulations = this.state.accumulations;
                    accumulations = [json.item].concat(accumulations);
                    this.setState({
                        accumulations: accumulations,
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency'],
                        accumulations_sum: (parseFloat(this.state.accumulations_sum) + parseFloat(json.rub_value)).toFixed(2),
                        accumulation_types: json.accumulation_types,
                    });
                }
            })
    }

    correctAccumulation = (e) => {
        var accumulation_id = e.target.dataset.id;
        document.getElementById('accumulation_' + accumulation_id).classList.remove('success_update_purchase');
        document.getElementById('accumulation_' + accumulation_id).classList.remove('danger_update_purchase');
        var complete_accumulation = false;
        if (e.target.id.includes('complete-accumulation-id')) {
            complete_accumulation = e.target.checked;
        }
        var accumulation_value = document.getElementById('accumulation-value-id-' + accumulation_id);
        var accumulation_currency = document.getElementById('accumulation-currency-id' + accumulation_id);
        accumulation_currency = accumulation_currency.options[accumulation_currency.selectedIndex].dataset.id;
        var data = {closed: complete_accumulation, value: accumulation_value.value, currency: accumulation_currency, id: accumulation_id};
        fetch(process.env.REACT_APP_BACKEND_URI + '/api/accumulation', {
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
                    document.getElementById('accumulation_' + accumulation_id).classList.add('danger_update_purchase');
                    return null;
                }
                const response = res.json();
                return response;
            })
            .then(json => {
                if (json) {
                    document.getElementById('accumulation_' + accumulation_id).classList.add('success_update_purchase');
                    if (complete_accumulation) {
                        var accumulations = this.state.accumulations;
                        accumulations = accumulations.filter(p => parseInt(p['id']) !== parseInt(accumulation_id));
                        this.setState({
                            accumulations: accumulations,
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            accumulations_sum: (parseFloat(this.state.accumulations_sum) - parseFloat(json.rub_value)).toFixed(2),
                            accumulation_types: json.accumulation_types,
                        });
                    }
                    else {
                        this.setState({
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency'],
                            accumulations_sum: (parseFloat(this.state.accumulations_sum) - parseFloat(json.rub_value)).toFixed(2),
                            accumulation_types: json.accumulation_types,
                        });
                    }
                }
            })
    }

    setAccumulationType(t) {
        this.setState({choosen_type: t});
    }

    renderAccumulationList() {
        return this.state.accumulations.map((accumulation) => {
            return (
                <div className='purchase_table_row_wrapper' id={'accumulation_' + accumulation.id}
                    key={'accumulation_' + accumulation.id} data-id={accumulation.id}>
                    <div className='purchase_chbox_date_wrapper'>
                        <div className='purchase_row_item preschedule_purchase_chbox_wrapper'>
                            <div className='custom_chbox_wrapper'>
                                <input type='checkbox' id={'complete-accumulation-id-' + accumulation.id} name={'accumulation_complete-' + accumulation.id}
                                    className='complete_purchase_chbox' data-id={accumulation.id} onChange={this.correctAccumulation} />
                                <span className='complete_purchase_chbox_span'></span>
                            </div>
                        </div>
                        <div className='purchase_row_item purchase_date_wrapper'>
                            <span className='purchase_time'>Закрыть</span>
                            <span className='purchase_date'>{accumulation.accumulation_type_name}</span>
                        </div>
                    </div>
                    <div className='purchase_info_wrapper'>
                        <div className='purchase_row_item'>
                            <span className='purchase_name'>{accumulation.name}</span>
                        </div>
                        <div className='purchase_row_item'>
                            <div className='purchase_value_currency_wrapper'>
                                <div className='purchase_value'>
                                    <input type='number' step='0.01' className='purchase_value exist_purchase_input' id={'accumulation-value-id-' + accumulation.id}
                                        data-id={accumulation.id} defaultValue={accumulation.value} onChange={_.debounce(this.correctAccumulation, 500)} />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id={'accumulation-currency-id' + accumulation.id} className='purchase_currency'>
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

                    <div className='page_wrapper'>
                        <div className='create_purchase_wrapper' id='create-purchase-wrapper-id'>
                            <div className='purchase_value_label'>
                                Название накопления
                            </div>
                            <div className='purchase_value_wrapper'>
                                <input type='text' className='purchase_name' id='accumulation-name-id' />
                            </div>
                            <div className='purchase_value_label'>
                                Накопленная сумма
                            </div>
                            <div className='purchase_wrapper'>
                                <div className='purchase_value_wrapper'>
                                    <input type='number' step='0.01' className='purchase_value' id='accumulation-value-id' />
                                </div>
                                <div className='purchase_currency_wrapper'>
                                    <select id='accumulation-currency-id' className='purchase_currency'>
                                        {this.props.renderCurrencies()}
                                    </select>
                                </div>
                            </div>
                            <div className='purchase_value_label'>
                                Тип накопления
                            </div>
                            <div className='accumulation_type_select_wrapper'>
                                <CreatableSingle accumulation_types={this.state.accumulation_types} setAccumulationType={this.setAccumulationType.bind(this)} />
                            </div>
                            <div className='create_purchase_wrapper'>
                                <div className='create_purchase_btn' id='create-accumulation-id' onClick={this.createAccumulation}>
                                    Отправить
                                </div>
                            </div>
                            <div className='purchase_create_message' id='accumulation-create-message-id'>
                            </div>
                        </div>

                        <div className='purchase_table_wrapper'>
                            <div className='purchase_table'>{this.renderAccumulationList()}</div>
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

class CreatableSingle extends React.Component<*, State> {
    handleChange = (newValue: any, actionMeta: any) => {
        if (newValue) {
            this.props.setAccumulationType(newValue.value);
        }
        else {
            this.props.setAccumulationType('');
        }
    };
    render() {
        return (
            <CreatableSelect
                isClearable
                onChange={this.handleChange}
                onInputChange={this.handleInputChange}
                options={this.props.accumulation_types}
            />
        );
    }
}

export default Accumulation