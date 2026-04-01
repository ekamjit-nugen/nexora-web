import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../auth/LoginScreen';
import { RegisterScreen } from '../auth/RegisterScreen';
import { useAuth } from '../../hooks/useAuth';

jest.mock('../../hooks/useAuth');

describe('Authentication Screens', () => {
  const mockNavigate = jest.fn();
  const mockLogin = jest.fn();
  const mockRegister = jest.fn();

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
      login: mockLogin,
      register: mockRegister,
      logout: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
    });
    jest.clearAllMocks();
  });

  describe('LoginScreen', () => {
    it('should render login form', () => {
      const { getByText, getByPlaceholderText } = render(
        <LoginScreen navigation={{ navigate: mockNavigate } as any} />
      );

      expect(getByText('Nexora')).toBeTruthy();
      expect(getByText('Welcome Back')).toBeTruthy();
      expect(getByPlaceholderText('Enter your email')).toBeTruthy();
      expect(getByPlaceholderText('Enter your password')).toBeTruthy();
    });

    it('should validate email format', async () => {
      const { getByPlaceholderText, getByText } = render(
        <LoginScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Please enter a valid email')).toBeTruthy();
      });
    });

    it('should validate password minimum length', async () => {
      const { getByPlaceholderText, getByText } = render(
        <LoginScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, '12345');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Password must be at least 6 characters')).toBeTruthy();
      });
    });

    it('should call login with valid credentials', async () => {
      mockLogin.mockResolvedValue({ success: true, user: {} });

      const { getByPlaceholderText, getByText } = render(
        <LoginScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should toggle password visibility', () => {
      const { getByPlaceholderText, getByText } = render(
        <LoginScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const passwordInput = getByPlaceholderText('Enter your password') as any;
      const toggleButton = getByText('👁️');

      expect(passwordInput.props.secureTextEntry).toBe(true);

      fireEvent.press(toggleButton);

      // After toggle, secureTextEntry should be false
      expect(passwordInput.props.secureTextEntry).toBe(false);
    });

    it('should navigate to register screen', () => {
      const { getByText } = render(
        <LoginScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const signUpLink = getByText('Sign Up');
      fireEvent.press(signUpLink);

      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });

    it('should display error message on login failure', async () => {
      mockLogin.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const { getByPlaceholderText, getByText } = render(
        <LoginScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Invalid credentials')).toBeTruthy();
      });
    });
  });

  describe('RegisterScreen', () => {
    it('should render registration form', () => {
      const { getByText, getByPlaceholderText } = render(
        <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
      );

      expect(getByText('Create Account')).toBeTruthy();
      expect(getByText('Join Nexora Today')).toBeTruthy();
      expect(getByPlaceholderText('First Name')).toBeTruthy();
      expect(getByPlaceholderText('Last Name')).toBeTruthy();
      expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    });

    it('should validate required fields', async () => {
      const { getByText } = render(
        <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const createButton = getByText('Create Account');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('First name is required')).toBeTruthy();
        expect(getByText('Last name is required')).toBeTruthy();
        expect(getByText('Email is required')).toBeTruthy();
        expect(getByText('Password is required')).toBeTruthy();
      });
    });

    it('should validate password match', async () => {
      const { getByPlaceholderText, getByText } = render(
        <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const firstNameInput = getByPlaceholderText('First Name');
      const lastNameInput = getByPlaceholderText('Last Name');
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const createButton = getByText('Create Account');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'john@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password456');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Passwords do not match')).toBeTruthy();
      });
    });

    it('should validate password minimum length', async () => {
      const { getByPlaceholderText, getByText } = render(
        <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const passwordInput = getByPlaceholderText('Create a strong password');
      const createButton = getByText('Create Account');

      fireEvent.changeText(passwordInput, '12345');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Password must be at least 8 characters')).toBeTruthy();
      });
    });

    it('should require terms agreement', async () => {
      const { getByPlaceholderText, getByText } = render(
        <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const firstNameInput = getByPlaceholderText('First Name');
      const lastNameInput = getByPlaceholderText('Last Name');
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const createButton = getByText('Create Account');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'john@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Please agree to the terms and conditions')).toBeTruthy();
      });
    });

    it('should call register with valid data', async () => {
      mockRegister.mockResolvedValue({ success: true, user: {} });

      const { getByPlaceholderText, getByText } = render(
        <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const firstNameInput = getByPlaceholderText('First Name');
      const lastNameInput = getByPlaceholderText('Last Name');
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const termsCheckbox = getByText('I agree to the Terms and Conditions');
      const createButton = getByText('Create Account');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'john@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(termsCheckbox.parent);
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        });
      });
    });

    it('should navigate to sign in screen', () => {
      const { getByText } = render(
        <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
      );

      const signInLink = getByText('Sign In');
      fireEvent.press(signInLink);

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('should display password requirements', () => {
      const { getByText } = render(
        <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
      );

      expect(getByText('At least 8 characters')).toBeTruthy();
    });
  });
});
