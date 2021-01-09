import React, { Component } from 'react';
import LoginForm from './components/LoginForm';
import Purchase from './components/Purchase';
import Accumulation from './components/Accumulation';
import Debt from './components/Debt';
import Loan from './components/Loan';
import ComingIns from './components/ComingIns';
import './App.css';
import './style.css';
import {
      BrowserRouter as Router,
      Switch,
      Route,
      Link
} from "react-router-dom";

class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            displayed_form: 'login',
            logged_in: localStorage.getItem('token') ? true : false,
            username: '',
            currencies: [],
            balance: 0.0,
            balance_currency: null,
        }
    }

    componentDidMount() {
        if (this.state.logged_in) {
            this.setState({displayed_form: ''})
            fetch(process.env.REACT_APP_BACKEND_URI + '/api/account', {
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
                    if (json) {
                        this.setState({
                            username: json.user['first_name'],
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency']
                        });
                        fetch(process.env.REACT_APP_BACKEND_URI + '/api/currency', {
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`
                          }
                        })
                            .then(res => {
                                if (res.status !== 200) {
                                    this.catchError(res.status);
                                    return null;
                                }
                                const response = res.json();
                                return response;
                            })
                            .then(json => {
                                this.setState({ currencies: json.items });
                            })
                    }
                })
        }
        else {
            this.setState({displayed_form: 'login'});
        }
    }

    handle_login = (e, data) => {
        e.preventDefault();
        fetch(process.env.REACT_APP_BACKEND_URI + '/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
            .then(res => {
                if (res.status !== 200) {
                    this.catchError(res.status);
                    throw new Error('Something went wrong');
                }
                const response = res.json();
                return response;
            })
            .then(json => {
                localStorage.setItem('token', json.access_token);
                localStorage.setItem('refresh_token', json.refresh_token);
                fetch(process.env.REACT_APP_BACKEND_URI + '/api/account', {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`
                    }
                })
                    .then(res => {
                        if (res.status !== 200) {
                            this.catchError(res.status);
                            return
                        }
                        const response = res.json();
                        return response;
                    })
                    .then(json => {
                        this.setState({
                            logged_in: true,
                            displayed_form: '',
                            username: json.user['first_name'],
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency']
                        });
                        fetch(process.env.REACT_APP_BACKEND_URI + '/api/currency', {
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${localStorage.getItem('token')}`
                            }
                        })
                            .then(res => {
                                if (res.status !== 200) {
                                    this.catchError(res.status);
                                    return
                                }
                                const response = res.json();
                                return response;
                            })
                            .then(json => {
                                this.setState({ currencies: json.items });
                            })
                    })
            })
            .catch(error => {
                this.setState({logged_in: false});
                localStorage.removeItem('token');
            })
    };

    handle_logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        this.setState({ logged_in: false, username: '', displayed_form: 'login' });
    };

    refresh_login = () => {
        var data = {refresh_token: localStorage.getItem('refresh_token')};
        fetch(process.env.REACT_APP_BACKEND_URI + '/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
            .then(res => {
                if (res.status === 401) {
                    this.catchError(res.status);
                    return
                }
                const response = res.json();
                return response;
            })
            .then(json => {
                localStorage.setItem('token', json.access_token);
                fetch(process.env.REACT_APP_BACKEND_URI + '/api/account', {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`
                    }
                })
                    .then(res => res.json())
                    .then(json => {
                        this.setState({
                            logged_in: true,
                            displayed_form: '',
                            username: json.user['first_name'],
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency']
                        });
                        fetch(process.env.REACT_APP_BACKEND_URI + '/api/currency', {
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`
                          }
                        })
                            .then(res => {
                                if (res.status !== 200) {
                                    this.catchError(res.status);
                                    return null;
                                }
                                const response = res.json();
                                return response;
                            })
                            .then(json => {
                                this.setState({ currencies: json.items });
                            })
                    });
            })
    }

    showMenu = (e) => {
        var menu = document.getElementById('side-bar-id');
        if (menu.style.display === 'block') {
            menu.style.display = 'none';
        }
        else {
            menu.style.display = 'block';
        }
    }

    catchError = (e) => {
        this.setState({ logged_in: false, username: '', displayed_form: 'login' });
        localStorage.removeItem('token');
        if (localStorage.getItem('refresh_token')) {
            this.refresh_login();
        }
    }

    renderCurrencies() {
        return this.state.currencies.map((currency) => {
            return (
                <option key={'currency-' + currency.id} id={'currency-' + currency.id} data-id={currency.id}>{currency.name}</option>
            )
        })
    }

    chooseTabMoneyMove = (e) => {
        if (e.target.id === 'purchase-tab-id') {
            document.getElementById('create-coming-ins-wrapper-id').style.display = 'none';
            document.getElementById('coming-ins-tab-id').classList.remove('selected_form')
            document.getElementById('create-purchase-wrapper-id').style.display = 'block';
            document.getElementById('purchase-tab-id').classList.add('selected_form')
        }
        else if (e.target.id === 'coming-ins-tab-id') {
            document.getElementById('create-purchase-wrapper-id').style.display = 'none';
            document.getElementById('purchase-tab-id').classList.remove('selected_form')
            document.getElementById('create-coming-ins-wrapper-id').style.display = 'block';
            document.getElementById('coming-ins-tab-id').classList.add('selected_form')
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
                    this.setState({
                        balance: json.balance['value'],
                        balance_currency: json.balance['currency']
                    });
                }
            })
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
                        this.setState({
                            balance: json.balance['value'],
                            balance_currency: json.balance['currency']
                        });
                    }
                })
    }

    render() {
        let form;
        switch (this.state.displayed_form) {
          case 'login':
            form = <LoginForm handle_login={this.handle_login} />;
            break;
          default:
            form = null;
        }

        var cls_wrapper_name = 'head_page_wrapper';
        var head_menu = '';
        var side_bar = '';
        if (this.state.logged_in) {
            cls_wrapper_name = 'head_page_wrapper_logged_in';
            head_menu = (
                <div className='user_headmenu_wrapper'>
                    <div className='head_wrapper'>
                        <div className='menu_btn_wrapper' onClick={this.showMenu}>
                            <div className='menu_btn'>
                                &#9776;
                            </div>
                        </div>
                        <div className='username_wrapper'>
                              {this.state.logged_in
                                ? `${this.state.username}`
                                : ''}
                        </div>
                        <div className='logout_wrapper' onClick={this.handle_logout}>
                            <div className='nav_btn' id='logout_btn_id' type='button'>
                                <img src='./icons/logout.svg' alt='logout' width='30px' />
                            </div>
                        </div>
                    </div>
                </div>
            );
            side_bar = (
                <div className='side_bar_wrapper' id='side-bar-id'>
                    <div className='side_bar_items_wrapper'>
                        <h3 className='side_bar_items_header'>Меню</h3>
                        <div className='side_bar_item_wrapper'>
                            <a href='/' className='side_bar_item'>Главная</a>
                        </div>
                        <div className='side_bar_item_wrapper'>
                            <a href='/purchases' className='side_bar_item'>Расходы</a>
                        </div>
                        <div className='side_bar_item_wrapper'>
                            <a href='/prescheduled_purchases' className='side_bar_item'>Запланированные покупки</a>
                        </div>
                        <div className='side_bar_item_wrapper'>
                            <a href='/loans' className='side_bar_item'>Одолженные суммы</a>
                        </div>
                        <div className='side_bar_item_wrapper'>
                            <a href='/debts' className='side_bar_item'>Долги</a>
                        </div>
                        <div className='side_bar_item_wrapper'>
                            <a href='/accumulations' className='side_bar_item'>Накопления</a>
                        </div>
                        <div className='side_bar_item_wrapper'>
                            <a href='/coming_ins' className='side_bar_item'>Доходы</a>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div className="App">
                <div className={cls_wrapper_name}>
                    {head_menu}
                    {side_bar}
                    {form}
                    {this.state.logged_in
                        ? <div>
                            <Router>
                                <switch>
                                    <Route exact path="/">
                                        <div className='mainwindow'>
                                            <div className='balance_wrapper'>
                                                <span>Баланс: </span>
                                                <span>{this.state.balance} </span>
                                                {this.state.balance_currency
                                                    ? <span>{this.state.balance_currency}</span>
                                                    : ''
                                                }
                                            </div>
                                            <div className='money_move_selector_wrapper'>
                                                <div className='money_move_selector'>
                                                    <div className='money_move_item selected_form' id='purchase-tab-id' onClick={this.chooseTabMoneyMove}>
                                                        Траты
                                                    </div>
                                                    <div className='money_move_item' id='coming-ins-tab-id' onClick={this.chooseTabMoneyMove}>
                                                        Доходы
                                                    </div>
                                                </div>
                                            </div>

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
                                                            {this.renderCurrencies()}
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
                                                <div className='create_purchase_btn_wrapper'>
                                                    <div className='create_purchase_btn' id='create-purchase-id' onClick={this.createPurchase}>
                                                        Отправить
                                                    </div>
                                                </div>
                                                <div className='purchase_create_message' id='purchase-create-message-id'>
                                                </div>
                                            </div>

                                            <div className='create_coming_ins_wrapper' id='create-coming-ins-wrapper-id'>
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
                                                            {this.renderCurrencies()}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className='create_coming-ins_wrapper'>
                                                    <div className='create_purchase_btn' id='create-coming-ins-id' onClick={this.createComingIns}>
                                                        Отправить
                                                    </div>
                                                </div>
                                                <div className='purchase_create_message' id='coming-ins-create-message-id'>
                                                </div>
                                            </div>
                                        </div>
                                    </Route>
                                    <Route exact path="/purchases">
                                        <Purchase logged_in={this.state.logged_in} catchError={this.catchError} prescheduled={false}
                                            renderCurrencies={this.renderCurrencies.bind(this)} />
                                    </Route>
                                    <Route exact path="/prescheduled_purchases">
                                        <Purchase logged_in={this.state.logged_in} catchError={this.catchError} prescheduled={true}
                                            renderCurrencies={this.renderCurrencies.bind(this)} />
                                    </Route>
                                    <Route exact path="/accumulations">
                                        <Accumulation logged_in={this.state.logged_in} catchError={this.catchError}
                                            renderCurrencies={this.renderCurrencies.bind(this)} />
                                    </Route>
                                    <Route exact path="/debts">
                                        <Debt logged_in={this.state.logged_in} catchError={this.catchError}
                                            renderCurrencies={this.renderCurrencies.bind(this)} />
                                    </Route>
                                    <Route exact path="/loans">
                                        <Loan logged_in={this.state.logged_in} catchError={this.catchError}
                                            renderCurrencies={this.renderCurrencies.bind(this)} />
                                    </Route>
                                    <Route exact path="/coming_ins">
                                        <ComingIns logged_in={this.state.logged_in} catchError={this.catchError}
                                            renderCurrencies={this.renderCurrencies.bind(this)} />
                                    </Route>
                                </switch>
                            </Router>
                          </div>
                        : ''
                    }
                </div>
            </div>
        );
    }

}

export default App;
