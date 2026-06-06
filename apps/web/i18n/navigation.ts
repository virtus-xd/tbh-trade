import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-farkında Link/router (TR önekini otomatik ekler). */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
