import { VFC } from "react";
import styles, { ClassNames } from "./App.module.scss";
import { classNamesFunc } from "classnames-generics";

const classNames = classNamesFunc<ClassNames>();
type Props = {
  active: boolean;
};

export const App: VFC<Props> = (props) => {
  return (
    <header
      className={classNames(
        styles.header,
        { [styles.active]: props.active },
        styles.row
      )}
    >
      vite-plugin-sass-dts-example
    </header>
  );
};
