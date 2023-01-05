import globalClassNames from './style.d'
declare const classNames: typeof globalClassNames & {
  readonly green: 'green'
  readonly 'header-1': 'header-1'
  readonly active: 'active'
  readonly input: 'input'
}
export = classNames
