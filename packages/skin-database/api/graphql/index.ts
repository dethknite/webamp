import { Router } from "express";
import { graphqlHTTP } from "express-graphql";

import { buildSchema } from "graphql";
import SkinModel from "../../data/SkinModel";
import { knex } from "../../db";
import SkinResolver from "./resolvers/SkinResolver";
import * as Skins from "../../data/skins";
import UserResolver from "./resolvers/UserResolver";

const router = Router();

const schema = buildSchema(`

"""A classic Winamp skin"""
type Skin {
  """Database ID of the skin"""
  id: Int,

  """MD5 hash of the skin's file"""
  md5: String,

  """URL of the skin on the Winamp Skin Museum"""
  museum_url: String,

  """URL of webamp.org with the skin loaded"""
  webamp_url: String,

  """URL of a screenshot of the skin"""
  screenshot_url: String,

  """URL to download the skin"""
  download_url: String,

  """
  Filename of skin when uploaded to the Museum. Note: In some cases a skin
  has been uploaded under multiple names. Here we just pick one.
  """
  filename: String,

  """Text of the readme file extracted from the skin"""
  readme_text: String,

  """Has the skin been flagged as "not safe for wrok"?"""
  nsfw: Boolean,

  """String representation (rgb usually) of the skin's average color"""
  average_color: String,

  """Has the skin been tweeted?"""
  tweeted: Boolean

  """List of @winampskins tweets that mentioned the skin."""
  tweets: [Tweet]

  """List of files contained within the skin's .wsz archive"""
  archive_files: [ArchiveFile]

  """The skin's "item" at archive.org"""
  internet_archive_item: InternetArchiveItem

  """
  Times that the skin has been reviewed either on the Museum's Tinder-style
  reivew page, or via the Discord bot.
  """
  reviews: [Review]
}


"""The judgement made about a skin by a moderator"""
enum Rating {
  APPROVED 
  REJECTED
  NSFW
}

"""
A review of a skin. Done either on the Museum's Tinder-style
reivew page, or via the Discord bot.
"""
type Review {
  """The skin that was reviewed"""
  skin: Skin

  """
  The user who made the review (if known). **Note:** In the early days we didn't
  track this, so many will be null.
  """
  reviewer: String

  """The rating that the user gave the skin"""
  rating: Rating
}


"""A file found within a Winamp Skin's .wsz archive"""
type ArchiveFile {
  """Filename of the file within the archive"""
  filename: String,
}

"""A tweet made by @winampskins mentioning a Winamp skin"""
type Tweet {
  """URL of the tweet"""
  url: String

  """Number of likes the tweet has received. Updated nightly. (Note: Recent likes on older tweets may not be reflected here)"""
  likes: Int

  """Number of retweets the tweet has received. Updated nightly. (Note: Recent retweets on older tweets may not be reflected here)"""
  retweets: Int
  skin: Skin
}

type InternetArchiveItem {
  """The Internet Archive's unique identifier for this item"""
  identifier: String

  """The URL where this item can be viewed on the Internet Archive"""
  url: String

  """The skin that this item contains"""
  skin: Skin
}

"""A collection of classic Winamp skins"""
type SkinsConnection {
  """The total number of skins"""
  count: Int

  """The list of skins"""
  nodes: [Skin]
}

type User {
  username: String
}

enum SkinsSortOption {
  """
  the Museum's (https://skins.webamp.org) special sorting rules.

  Roughly speaking, it's:

  1. The four classic default skins
  2. Tweeted skins first (sorted by the number of likes/retweets)
  3. Approved, but not tweeted yet, skins
  4. Unreviwed skins
  5. Rejected skins
  6. NSFW skins
  """
  MUSEUM
}

enum SkinsFilterOption {
  """All the skins that have been approved for tweeting"""
  APPROVED
}

type Query {
  """The currently authenticated user, if any."""
  me: User

  """Get a skin by its MD5 hash"""
  fetch_skin_by_md5(md5: String!): Skin

  """
  All skins in the database

  **Note:** We don't currently support combining sorting and filtering.
  """
  skins(
    first: Int,
    offset: Int,
    sort: SkinsSortOption,
    filter: SkinsFilterOption
  ): SkinsConnection
}`);

class SkinsConnection {
  _first: number;
  _offset: number;
  _sort: string;
  _filter: string;
  constructor(first: number, offset: number, sort: string, filter: string) {
    this._first = first;
    this._offset = offset;
    this._filter = filter;
    this._sort = sort;
  }
  async count() {
    const count = await knex("skins")
      .where({ skin_type: 1 })
      .count("*", { as: "count" });
    return count[0].count;
  }
  async nodes(args, ctx) {
    if (this._sort === "MUSEUM") {
      if (this._filter) {
        throw new Error(
          "We don't support combining sorting and filtering at the same time."
        );
      }
      const items = await Skins.getMuseumPage({
        first: this._first,
        offset: this._offset,
      });
      return Promise.all(
        items.map(async (item) => {
          const model = await SkinModel.fromMd5Assert(ctx, item.md5);
          return new SkinResolver(model);
        })
      );
    }

    let query = knex("skins");

    if (this._filter === "APPROVED") {
      query = query
        .leftJoin("skin_reviews", "skin_reviews.skin_md5", "=", "skins.md5")
        .where("review", "APPROVED");
    }

    const skins = await query
      .where({ skin_type: 1 })
      .select()
      .limit(this._first)
      .offset(this._offset);
    return skins.map((skin) => {
      return new SkinResolver(new SkinModel(ctx, skin));
    });
  }
}

const root = {
  async fetch_skin_by_md5({ md5 }, { ctx }) {
    const skin = await SkinModel.fromMd5(ctx, md5);
    if (skin == null) {
      return null;
    }
    return new SkinResolver(skin);
  },
  async skins({ first, offset, sort, filter }) {
    if (first > 1000) {
      throw new Error("Maximum limit is 1000");
    }
    return new SkinsConnection(first, offset, sort, filter);
  },
  me() {
    return new UserResolver();
  },
};

router.use(
  "/",
  graphqlHTTP({
    typeResolver(_type) {
      throw new Error("We probably need to implement typeResolver");
    },
    schema: schema,
    rootValue: root,
    graphiql: true,
  })
);

export default router;
