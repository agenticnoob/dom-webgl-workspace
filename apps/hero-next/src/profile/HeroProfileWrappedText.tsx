import React, { Fragment } from "react";

import { splitHeroProfileText, type HeroProfileWrapSide } from "./wrap";

type HeroProfileWrappedTextProps = {
  readonly side: HeroProfileWrapSide;
  readonly text: string;
};

export function HeroProfileWrappedText({
  side,
  text,
}: HeroProfileWrappedTextProps) {
  return (
    <>
      <span className="hero-sr-only">{text}</span>
      <span
        className="hero-profile__wrapped-text"
        data-profile-wrap-text=""
        data-profile-wrap-side={side}
        aria-hidden="true"
      >
        {splitHeroProfileText(text).map((segment, index) =>
          /^\s+$/.test(segment) ? (
            <Fragment key={index}>{segment}</Fragment>
          ) : (
            <span
              key={index}
              className="hero-profile__wrap-token"
              data-profile-wrap-token=""
            >
              {segment}
            </span>
          ),
        )}
      </span>
    </>
  );
}
