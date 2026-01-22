import { forwardRef, startTransition } from 'react';
import { NavLink, NavLinkProps, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface TransitionLinkProps extends Omit<NavLinkProps, 'onClick'> {
  activeClassName?: string;
}

export const TransitionLink = forwardRef<HTMLAnchorElement, TransitionLinkProps>(
  ({ to, children, className, activeClassName, ...props }, ref) => {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      startTransition(() => {
        navigate(typeof to === 'string' ? to : to.pathname || '/');
      });
    };

    return (
      <NavLink
        ref={ref}
        to={to}
        onClick={handleClick}
        className={({ isActive }) =>
          cn(
            typeof className === 'function' ? className({ isActive, isPending: false, isTransitioning: false }) : className,
            isActive && activeClassName
          )
        }
        {...props}
      >
        {children}
      </NavLink>
    );
  }
);

TransitionLink.displayName = 'TransitionLink';
