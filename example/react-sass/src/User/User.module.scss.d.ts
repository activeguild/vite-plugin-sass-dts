import globalClassNames, { ClassNames as GlobalClassNames } from '../style.d'
declare const classNames: typeof globalClassNames & {
  readonly name: 'name'
}
export = classNames
export type UserNames = 'name' | GlobalClassNames
