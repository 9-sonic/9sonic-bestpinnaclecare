import { Component } from 'react';
import { isChunkLoadError } from '../../utils/lazyWithRetry.js';

// Catches render errors so one broken screen does not leave the carer staring
// at a blank page mid shift.
//
// A failed screen download is treated differently from a genuine bug: it is
// almost always transient, so we clear the error and re-render rather than
// showing an alarming message the carer has to act on.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, recovering: false };
    this.recoverTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { error, recovering: isChunkLoadError(error) };
  }

  componentDidCatch(error, info) {
    if (isChunkLoadError(error)) {
      // Give the network a moment, then drop the error so React retries the
      // lazy import (which has its own retry and reload fallback).
      this.recoverTimer = setTimeout(() => {
        this.setState({ error: null, recovering: false });
      }, 600);
      return;
    }
    // In production this is where a reporting service would be called.
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
  }

  componentWillUnmount() {
    clearTimeout(this.recoverTimer);
  }

  // Unregisters the service worker and drops its caches, then reloads from the
  // network. Clock events waiting to sync are in localStorage and survive.
  handleHardReset = async () => {
    try {
      const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
      await Promise.all(registrations.map((r) => r.unregister()));
      const keys = (await caches?.keys()) ?? [];
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* nothing more we can do; the reload below is still worth trying */
    }
    // Cache-busted so the browser cannot serve the same broken document again.
    window.location.replace(`${window.location.pathname}?fresh=${Date.now()}`);
  };

  handleRetry = () => {
    this.setState({ error: null, recovering: false });
  };

  render() {
    const { error, recovering } = this.state;
    if (!error) return this.props.children;

    // Transient screen load failure: show a quiet spinner, not an error page.
    if (recovering) {
      return (
        <div className="spinner spinner--fullscreen" role="status">
          <span className="spinner__dot" aria-hidden="true" />
          <span className="sr-only">Loading</span>
        </div>
      );
    }

    return (
      <div className="error-screen">
        <h1 className="error-screen__title">Something went wrong</h1>
        <p className="error-screen__text">
          The app hit an unexpected problem. Anything you have clocked is still saved on this
          device.
        </p>
        <div className="error-screen__actions">
          <button type="button" className="btn btn--primary btn--md" onClick={this.handleRetry}>
            Try again
          </button>
          <button
            type="button"
            className="btn btn--white btn--md"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
        </div>

        {/* Last resort, and the reason it exists: the app is cached by a
            service worker so it can run offline. If a broken version ever gets
            into that cache, reloading just serves the same broken copy back
            and the carer is stuck with no way out. This clears the cache and
            fetches a clean copy. Unsent clock events live in localStorage and
            are deliberately left alone. */}
        <button type="button" className="error-screen__reset" onClick={this.handleHardReset}>
          Still broken? Clear the app cache and reload
        </button>
      </div>
    );
  }
}
