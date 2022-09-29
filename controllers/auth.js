import User from "../models/user";
import jwt from "jsonwebtoken";
import { hashPassword, comparePassword } from "../utils/auth";
import AWS from "aws-sdk";
const nanoid = require("nanoid");

const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
};
const SES = new AWS.SES(awsConfig);

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    // console.log(req.body);
    // validation
    if (!name) return res.status(400).send("Name is required");
    if (!password || password.legth < 6) {
      return res
        .status(400)
        .send("Password is required and should be minimum 6 characters long");
    }
    let userExist = await User.findOne({ email }).exec();
    if (userExist) return res.status(400).send("Email is taken");

    // hashed password
    const hashedPassword = await hashPassword(password);

    // register , save
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });
    await user.save();
    // console.log("saved user", user);
    return res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send("Error. Try again");
  }
};

export const login = async (req, res) => {
  try {
    // console.log(req.body);
    const { email, password } = req.body;

    // check if out db has user with that email
    const user = await User.findOne({ email }).exec();
    if (!user) return res.status(400).send("No user found");
    // check password
    const match = await comparePassword(password, user.password);
    !match && res.status(400).send("Wrong password");
    // create signed jwt
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "10d",
    });

    // return user and token to client, exclude hashed password
    user.password = undefined;

    //  send token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      // secure: true // only works on https
    });

    // send user as json response
    res.json(user);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Error. Try again");
  }
};

export const logout = (req, res) => {
  try {
    res.clearCookie("token");
    return res.json({ message: "Signout success" });
  } catch (err) {
    console.log("error from logout catch : ", err);
  }
};

export const currentUser = async (req, res) => {
  try {
    const user = await User.findById(req.auth._id).select("-password").exec();
    // console.log("Current user ", user);
    return res.json({ ok: true });
  } catch (err) {
    console.log("error from currentUser catch : ", err);
  }
};

export const sendTestEmail = async (req, res) => {
  // console.log("send email using SES");
  // res.json({ ok: true });
  const params = {
    Source: process.env.EMAIL_FROM,
    Destination: {
      ToAddresses: [process.env.EMAIL_FROM],
    },
    ReplyToAddresses: [process.env.EMAIL_FROM],
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `
            <html>
              <h1>Reset password link</h1
              <p>Please use the following link to reset your password</p>
            </html>
          `,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Password reset link",
      },
    },
  };
  const emailSent = SES.sendEmail(params).promise();

  console.log(emailSent);
  emailSent
    .then((data) => {
      console.log(data);
      res.json({ ok: true });
    })
    .catch((err) => {
      console.log("error from emailSent", err);
    });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const shortCode = await nanoid(7).toUpperCase();
    console.log(shortCode);
    const user = await User.findOneAndUpdate(
      { email },
      {
        passwordResetCode: shortCode,
      }
    );
    if (!user) return res.status(400).send("User not found");

    // prepare for email
    const params = {
      Source: process.env.EMAIL_FROM,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
              <html>
                <h1>Rest password</h1>
                <p>User this code to reset your password</p>
                <h2 style="color:red;">${shortCode}</h2>
                <i>youDemy.com</i>
              </html>
            `,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Reset Password",
        },
      },
    };

    // sent email using SES
    const emailSent = SES.sendEmail(params).promise();
    emailSent
      .then((data) => {
        console.log(data);
        res.json({ ok: true });
      })
      .catch((err) => {
        console.log("Error from forgotPassword's SES catch", err);
      });
  } catch (err) {
    console.log("error from backend forgotPassword try catch", err);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    // console.table({ email, code, newPassword });

    const hashedPassword = await hashPassword(newPassword);
    const user = User.findOneAndUpdate(
      {
        email,
        passwordResetCode: code,
      },
      {
        password: hashedPassword,
        passwordResetCode: "",
      }
    ).exec();
    console.log(user);
    res.json({ ok: true });
  } catch (err) {
    console.log("error from backend resetPassword try catch", err);
    return res.status(400).send("Error try again");
  }
};
