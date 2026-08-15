import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ChartPanel render error caught by ErrorBoundary:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: '#94a3b8',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 12,
          margin: 8,
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
          <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#fca5a5', marginBottom: 4 }}>
            Unable to render chart
          </h4>
          <p style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 12 }}>
            {this.state.error?.message || 'Data could not be plotted with the selected axis format.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              background: 'rgba(255, 0, 113, 0.15)',
              border: '1px solid rgba(255, 0, 113, 0.4)',
              color: '#ff85be',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            🔄 Reset Chart
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
