import { createContext, useContext } from 'react';

// Lets any screen open the slide-in menu drawer owned by AppLayout.
export const MenuContext = createContext({ openMenu: () => {} });

export function useMenu() {
  return useContext(MenuContext);
}
