import { onRequest as __api_admin___path___js_onRequest } from "D:\\pc cleaner\\admin-portal\\functions\\api\\admin\\[[path]].js"

export const routes = [
    {
      routePath: "/api/admin/:path*",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin___path___js_onRequest],
    },
  ]