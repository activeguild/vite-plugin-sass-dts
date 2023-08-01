import globalClassNames from '../@types/style.d'
declare const classNames: typeof globalClassNames & {
  readonly name: 'name'
}
export = classNames
