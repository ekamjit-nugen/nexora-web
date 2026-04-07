/**
 * Tests for ErrorBoundary component
 *
 * Verifies normal rendering, error catching, reset behavior,
 * and custom fallback support.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

// Suppress console.error during tests since we intentionally throw
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// A component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Child content</div>;
}

// A component that always throws
function AlwaysThrows(): JSX.Element {
  throw new Error("Boom");
}

describe("ErrorBoundary", () => {
  it("renders children normally when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("catches error and shows default fallback UI", () => {
    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it('"Try again" button resets error state and remounts children', () => {
    // Use a stateful wrapper to control throwing
    let shouldThrow = true;
    function Wrapper() {
      if (shouldThrow) throw new Error("controlled");
      return <div>Recovered content</div>;
    }

    render(
      <ErrorBoundary>
        <Wrapper />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the error before clicking retry
    shouldThrow = false;

    fireEvent.click(screen.getByText("Try again"));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    const customFallback = <div>Custom error page</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <AlwaysThrows />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom error page")).toBeInTheDocument();
    // Default fallback should NOT appear
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("uses errorCount key to force remount of children after reset", () => {
    const mountSpy = jest.fn();

    function TrackedChild() {
      React.useEffect(() => {
        mountSpy();
      }, []);
      return <div>Tracked</div>;
    }

    let shouldThrow = false;
    function MaybeThrow() {
      if (shouldThrow) throw new Error("oops");
      return <TrackedChild />;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );

    expect(mountSpy).toHaveBeenCalledTimes(1);

    // Trigger error
    shouldThrow = true;
    rerender(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );

    // Fix and reset
    shouldThrow = false;
    fireEvent.click(screen.getByText("Try again"));

    // Child should be mounted again (errorCount key changed)
    expect(mountSpy).toHaveBeenCalledTimes(2);
  });
});
