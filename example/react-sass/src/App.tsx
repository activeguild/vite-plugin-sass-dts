import { FC } from 'react'
import styles from './App.module.scss'
import { classNamesFunc } from 'classnames-generics'
import { User } from './User/User'
import styles2 from './exclude/Exclude.module.scss'

const classNames = classNamesFunc<keyof typeof styles>()
type Props = {
  active: boolean
}

export const App: FC<Props> = (props) => {
  return (
    <header
      className={classNames(
        styles['header-1'],
        { [styles.active]: props.active },
        styles.row
      )}
    >
      <p className={styles['ratio']} style={{ color: styles.green }}>
        vite-plugin-sass-dts-example
      </p>
      <User />
    </header>
  )
}
