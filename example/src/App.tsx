import { VFC } from 'react'
import styles from './App.module.scss'
import { classNamesFunc } from 'classnames-generics'

const classNames = classNamesFunc<keyof typeof styles>()
type Props = {
  active: boolean
}

export const App: VFC<Props> = (props) => {
  return (
    <header
      className={classNames(
        styles['header-1'],
        { [styles.active]: props.active },
        styles.row
      )}
    >
      <p style={{ color: styles.green }}>vite-plugin-sass-dts-example</p>
    </header>
  )
}
