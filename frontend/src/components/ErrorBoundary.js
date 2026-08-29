import PropTypes from "prop-types";
import { Component } from "react";
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  // Called during rendering when a child throws. Returns the new state
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // Called after the error is caught. 
  componentDidCatch(error, info) {
    console.error("Render error caught by boundary:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="state state-error">
          <p>Something went wrong displaying this page.</p>
          <button type="button" onClick={this.handleReset}>Try again</button>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  // node covers anything React can render: elements, strings, arrays, null.
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;