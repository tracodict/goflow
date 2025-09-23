import { createContext } from "react";
import { en } from "./locales/en.ts";
import type { Translation } from "./translation-keys.ts";

export const TranslationContext = createContext<Translation>(en);
