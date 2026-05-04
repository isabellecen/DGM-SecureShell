import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import connectPgSimple from "connect-pg-simple";
import crypto from "crypto";
import { pool } from "./db";

declare global {
  namespace Express {
    interface User {
      username: string;
    }
  }
}

function adminUsername(): string {
  return process.env.ADMIN_USERNAME || "admin";
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return secret || "development-only-session-secret";
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function verifyScryptPassword(password: string, encoded: string): boolean {
  const [, salt, hash] = encoded.split(":");
  if (!salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return safeEqual(actual, expected);
}

function verifyPlainPassword(password: string, expectedPassword: string): boolean {
  const actual = crypto.createHash("sha256").update(password).digest();
  const expected = crypto.createHash("sha256").update(expectedPassword).digest();
  return safeEqual(actual, expected);
}

function verifyAdminPassword(password: string): boolean {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash?.startsWith("scrypt:")) {
    return verifyScryptPassword(password, hash);
  }

  const expectedPassword =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production" ? undefined : "admin");

  return expectedPassword ? verifyPlainPassword(password, expectedPassword) : false;
}

export function registerAuth(app: Express) {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.ADMIN_PASSWORD &&
    !process.env.ADMIN_PASSWORD_HASH
  ) {
    throw new Error("ADMIN_PASSWORD or ADMIN_PASSWORD_HASH must be set in production");
  }

  const PgSession = connectPgSimple(session);
  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }
  const secureCookie =
    process.env.COOKIE_SECURE === "1" ||
    (process.env.NODE_ENV === "production" && process.env.TRUST_PROXY === "1");

  app.use(
    session({
      name: "protectiveshell.sid",
      secret: sessionSecret(),
      resave: false,
      saveUninitialized: false,
      store: new PgSession({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );

  passport.use(
    new LocalStrategy((username, password, done) => {
      if (username !== adminUsername() || !verifyAdminPassword(password)) {
        return done(null, false, { message: "Invalid username or password" });
      }

      return done(null, { username });
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.username);
  });

  passport.deserializeUser((username: string, done) => {
    if (username === adminUsername()) {
      return done(null, { username });
    }
    return done(null, false);
  });

  app.use(passport.initialize());
  app.use(passport.session());

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info?: { message?: string }) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid username or password" });
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({ user });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("protectiveshell.sid");
        return res.status(204).send();
      });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    return res.json({ user: req.user });
  });

  app.use("/api", requireAuth);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated?.()) {
    return next();
  }

  return res.status(401).json({ message: "Not authenticated" });
}
