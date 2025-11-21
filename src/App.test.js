import { render, screen } from '@testing-library/react';
import React from 'react';

const mockUseAuth = jest.fn();

jest.mock('./context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

jest.mock('flowbite-react', () => {
  const Alert = ({ children, ...props }) => (
    <div role="alert" {...props}>
      {children}
    </div>
  );
  const Button = ({ children, ...props }) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const Card = ({ children, ...props }) => (
    <div {...props}>
      {children}
    </div>
  );
  const Label = ({ children, htmlFor, ...props }) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  );
  const Badge = ({ children, ...props }) => (
    <span {...props}>
      {children}
    </span>
  );
  const Spinner = (props) => <div {...props} />;
  const TextInput = (props) => <input {...props} />;

  return { Alert, Button, Card, Label, Badge, Spinner, TextInput, Select: (props) => <select {...props} /> };
});

jest.mock('./TaskList', () => () => <div data-testid="tasklist">Task list mock</div>);

jest.mock('./components/ProjectSelector', () => {
  const React = require('react');

  return ({ onSelect, onProjectsChange }) => {
    React.useEffect(() => {
      const project = { id: 'project-1', name: 'Proyecto demo' };
      onProjectsChange?.([project]);
      onSelect?.(project.id);
    }, []);

    return <div data-testid="project-selector">Project selector mock</div>;
  };
});

const renderApp = () => {
  const App = require('./App').default;
  return render(<App />);
};

afterEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReset();
});

test('muestra formulario de autenticación cuando no hay usuario', () => {
  mockUseAuth.mockReturnValue({
    user: null,
    initializing: false,
    authLoading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    error: null,
    setError: jest.fn()
  });

  renderApp();

  expect(screen.getByPlaceholderText(/tu@email.com/i)).toBeInTheDocument();
  expect(screen.getByText(/inicia sesión para gestionar tus tareas/i)).toBeInTheDocument();
  expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
});

test('muestra la lista de tareas cuando hay usuario', () => {
  mockUseAuth.mockReturnValue({
    user: { id: '123', email: 'demo@example.com' },
    initializing: false,
    authLoading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    error: null,
    setError: jest.fn()
  });

  renderApp();

  expect(screen.getByTestId('project-selector')).toBeInTheDocument();
  expect(screen.getByTestId('tasklist')).toBeInTheDocument();
  expect(screen.getByText(/demo@example.com/i)).toBeInTheDocument();
});
