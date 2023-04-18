import globalClassNames from './style.d'
declare const classNames: typeof globalClassNames & {
  readonly zoo: 'zoo'
  readonly green: 'green'
  readonly 'header-1': 'header-1'
  readonly active: 'active'
  readonly input: 'input'
  readonly test: 'test'
}
export = classNames
