import globalClassNames, { ClassNames as GlobalClassNames } from './style.d'
declare const classNames: typeof globalClassNames & {}
export default classNames
export type ClassNames = GlobalClassNames
