import globalClassNames from './style.d'
declare const classNames: typeof globalClassNames & {
  readonly 'header-1': 'header-1'
  readonly active: 'active'
}
export = classNames
