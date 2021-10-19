import { Plugin, UserConfig, ConfigEnv } from "vite";
import { isCSSRequest } from "./util";
import { main } from "./main";

export type Option = {
  allGenerate: boolean;
};

export default function Plugin({ allGenerate }: Option): Plugin {
  let cacheConfig: UserConfig;
  let cacheEnv: ConfigEnv;
  return {
    config(config, env) {
      cacheConfig = config;
      cacheEnv = env;
    },
    name: "vite-plugin-sass-dts",
    handleHotUpdate(context) {
      if (!isCSSRequest(context.file)) return;
      main(context.file, cacheConfig);
      return;
    },
    transform(code, id, ssr) {
      if (!allGenerate) {
        return { code };
      }

      let fileName = id.replace("?used", "");
      if (!isCSSRequest(fileName)) return { code };

      main(fileName, cacheConfig);

      return { code };
    },
  };
}
