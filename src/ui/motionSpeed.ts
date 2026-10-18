import { createContext, useContext } from "react";
export const MotionSpeed = createContext(1);
export const useMotionSpeed = () => useContext(MotionSpeed);
