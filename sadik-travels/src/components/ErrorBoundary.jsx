import { Component } from 'react'

/**
 * Catches render-time crashes (a malformed Firestore doc, a rules error that
 * throws during mapping, …) so one bad screen cannot white-page the app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[st-data] render error', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <div className="crash-card">
          <h2>Something broke on this screen</h2>
          <p className="muted">{String(this.state.error?.message || this.state.error)}</p>
          <div className="crash-actions">
            <button type="button" className="btn ghost" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
