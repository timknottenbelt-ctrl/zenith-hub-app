import { startTransition, useCallback } from "react";
import { type NavigateOptions, type To, useNavigate } from "react-router-dom";

type TransitionNavigate = {
  (to: To, options?: NavigateOptions): void;
  (delta: number): void;
};

/**
 * Wraps react-router's navigate() in React.startTransition to prevent
 * "A component suspended while responding to synchronous input" crashes
 * when navigating to lazy-loaded routes.
 */
export function useTransitionNavigate(): TransitionNavigate {
  const navigate = useNavigate();

  return useCallback(
    ((to: To | number, options?: NavigateOptions) => {
      startTransition(() => {
        if (typeof to === "number") {
          navigate(to);
        } else {
          navigate(to, options);
        }
      });
    }) as TransitionNavigate,
    [navigate]
  );
}
