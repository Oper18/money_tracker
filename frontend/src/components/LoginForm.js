import React from 'react';
import PropTypes from 'prop-types';

class LoginForm extends React.Component {
  state = {
    username: '',
    password: ''
  };

  handle_change = e => {
    const name = e.target.name;
    const value = e.target.value;
    this.setState(prevstate => {
      const newState = { ...prevstate };
      newState[name] = value;
      return newState;
    });
  };

  render() {
    return (
      <form onSubmit={e => this.props.handle_login(e, this.state)} className='login_form'>
        <div className='login_fields_wrapper'>
            <div className='login_field_wrapper'>
                <h4 className='login_header'>Вход</h4>
            </div>
            <div className='login_field_wrapper'>
                <label htmlFor="username">Логин</label>
                <input
                  className="login-input"
                  type="text"
                  name="username"
                  value={this.state.username}
                  onChange={this.handle_change}
                />
            </div>
            <div className='login_field_wrapper'>
                <label htmlFor="password">Пароль</label>
                <input
                  className="login-input"
                  type="password"
                  name="password"
                  value={this.state.password}
                  onChange={this.handle_change}
                />
            </div>
            <div className='login_field_wrapper'>
                <input type="submit" value='Войти' className='submit_button' />
            </div>
        </div>
      </form>
    );
  }
}

export default LoginForm;

LoginForm.propTypes = {
  handle_login: PropTypes.func.isRequired
};