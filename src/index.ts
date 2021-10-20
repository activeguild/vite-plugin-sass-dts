import { Plugin, UserConfig, ConfigEnv } from "vite";
import { isCSSRequest } from "./util";
import { main } from "./main";
import { PluginOption } from "./type";

export default function Plugin(option: PluginOption): Plugin {
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
      main(context.file, cacheConfig, option);
      return;
    },
    transform(code, id) {
      if (!option.allGenerate) {
        return { code };
      }

      let fileName = id.replace("?used", "");
      if (!isCSSRequest(fileName)) return { code };

      main(fileName, cacheConfig, option);

      return { code };
    },
  };
}
