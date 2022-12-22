import { FC } from 'react'
import styles from './User.module.scss'
import { classNamesFunc } from 'classnames-generics'

const classNames = classNamesFunc<keyof typeof styles>()

export const User: FC = (props) => {
  return <p className={classNames(styles.name, styles.row)}>foo</p>
}
