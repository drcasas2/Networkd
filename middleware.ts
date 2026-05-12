import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  if (!req.auth) {
    const { pathname, search } = req.nextUrl;
    const url = new URL("/signin", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname + search);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/book/:path*", "/chat/:path*"],
};
