import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

console.log("NEXTAUTH_SECRET seen:", !!process.env.NEXTAUTH_SECRET)
console.log("NEXTAUTH_URL:", process.env.NEXTAUTH_URL)
console.log("NODE_ENV:", process.env.NODE_ENV)

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
