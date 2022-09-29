import User from "../models/user";
const stripe = require("stripe")(process.env.STRIPE_SECRET);
import queryString from "query-string";
export const makeInstructor = async (req, res) => {
  try {
    // 1.   Find user from db
    const user = await User.findById(req.body._id).exec();

    // 2.   If user don't have stripe_account_id yet, then create new
    if (!user.stripe_account_id) {
      const account = await stripe.accounts.create({ type: "express" });
      user.stripe_account_id = account.id;
      user.save();
    }

    // 3.   Create account link based on account id (for frontend to complete On boarding)

    let accountLink = await stripe.accountLinks.create({
      account: user.stripe_account_id,
      refresh_url: process.env.STRIPE_REDIRECT_URL,
      return_url: process.env.STRIPE_REDIRECT_URL,
      type: "account_onboarding",
    });

    // 4.   pre-fill any info such as email(optional), then send url response to frontend
    accountLink = Object.assign(accountLink, {
      "stripe_user[email]": user.email,
    });
    // 5.   then send the account link as response to frontend
    res.send(`${accountLink.url}?${queryString.stringify(accountLink)}`);
  } catch (e) {
    console.log("error from controllers/instructor catch =>", e);
  }
};

export const getAccountStatus = async (req, res) => {
  try {
    const user = await User.findById(req.body._id).exec();
    const account = await stripe.accounts.retrieve(user.stripe_account_id);
    // console.log("Account =>", account);
    if (!account.charges_enabled) {
      return res.status(401).send("Unauthorized");
    } else {
      const statusUpdated = await User.findByIdAndUpdate(
        user._id,
        {
          stripe_seller: account,
          $addToSet: { role: "Instructor" },
        },
        {
          new: true,
        }
      )
        .select("-password")
        .exec();
      // console.log("statusUpdated", statusUpdated);
      res.json(statusUpdated);
    }
  } catch (err) {
    console.log("Errro from getAccountStatus =>", err);
  }
};

export const currentInstructor = async (req, res) => {
  try {
    let user = await User.findById(req.auth._id).select("-password").exec();
    if (!user.role.includes("Instructor")) {
      return res.sendStatus(403);
    } else {
      res.json({ ok: true });
    }
  } catch (err) {
    console.log("error from currentInstructor =>", err);
  }
};
