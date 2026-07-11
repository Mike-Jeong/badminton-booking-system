// /admin 전체에 적용되는 최소 레이아웃. 로그인 화면(/admin/login)에는 관리자 전용
// 네비게이션/로그아웃 버튼을 보여주지 않기 위해, 실제 chrome은
// app/admin/(protected)/layout.tsx (route group, URL에는 나타나지 않음)에서 담당한다.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
