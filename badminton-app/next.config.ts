import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Phase 0/1 범위에서는 lint 통과를 빌드 필수 조건으로 삼지 않는다.
    // `npm run lint`는 별도로 실행 가능하도록 devDependency는 유지한다.
    ignoreDuringBuilds: true,
  },
  // @libsql/client는 네이티브 바이너리(.node)와 README/LICENSE 등 비-JS 파일을 포함하므로
  // webpack이 이를 그대로 번들링하려 하면 파싱 오류가 난다. 서버 전용 패키지로 지정해
  // webpack 번들링 대상에서 제외하고 런타임에 require로 로드하도록 한다.
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
};

export default nextConfig;
