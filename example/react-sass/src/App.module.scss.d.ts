import globalClassNames from './@types/style.d'
declare const classNames: typeof globalClassNames & {
  readonly green: 'green'
  readonly 'header-1': 'header-1'
  readonly active: 'active'
  readonly input: 'input'
  readonly test: 'test'
  readonly myclass: 'myclass'
}
export default classNames
