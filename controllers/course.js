import AWS from "aws-sdk";
const nanoid = require("nanoid");
import Course from "../models/course";
import Completed from "../models/completed";
import slugify from "slugify";
import fs from "fs";
import User from "../models/user";
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
};
const S3 = new AWS.S3(awsConfig);
export const uploadImage = async (req, res) => {
  // console.log(req.body);
  try {
    const { image } = req.body;
    if (!image) return res.status(400).send("No image");

    // prepare the image
    const base64Data = new Buffer.from(
      image.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const type = image.split(";")[0].split("/")[1];

    // image params
    const params = {
      Bucket: "youdemy-bucket",
      Key: `${nanoid()}.${type}`,
      Body: base64Data,
      ACL: "public-read",
      ContentEncoding: "base64",
      ContentType: `image/${type}`,
    };

    // upload to s3
    S3.upload(params, (err, data) => {
      if (err) {
        console.log("Error from server/controller/course upload to s3 =>", err);
        return res.sendStatus(400);
      }
      // console.log(data);
      res.send(data);
    });
  } catch (e) {
    console.log("Error from uploadImage from controllers/course => : ", e);
  }
};

export const removeImage = async (req, res) => {
  try {
    const { image } = req.body;
    // console.log(image);

    // image params
    const params = {
      Bucket: image.Bucket,
      Key: image.Key,
    };

    // delete from s3
    S3.deleteObject(params, (err, data) => {
      if (err) {
        console.log("Error from S3.deleteObject =>", err);
        res.sendStatus(400);
      }
      res.send({ ok: true });
    });
  } catch (e) {
    console.log("Error from removeImage catch =>", e);
  }
};

export const create = async (req, res) => {
  // // console.log("create course");
  // console.log(req.body);
  try {
    const alreadyExist = await Course.findOne({
      slug: slugify(req.body.name.toLowerCase()),
    });

    if (alreadyExist) return res.status(400).send("Title is taken");

    const course = await new Course({
      slug: slugify(req.body.name),
      instructor: req.auth._id,
      ...req.body,
    }).save();
    res.json(course);
  } catch (e) {
    console.log(
      "Error from server/controler/course create function's catch =>",
      e
    );
  }
};

export const read = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug })
      .populate("instructor", "_id name")
      .exec();
    res.json(course);
  } catch (e) {
    console.log(
      "Error from server/controler/course read function's catch =>",
      e
    );
  }
};
export const uploadVideo = async (req, res) => {
  try {
    // console.log("req.auth._id", req.auth._id);
    // console.log("req.params.insttructorId", req.params.instructorId);

    if (req.auth._id != req.params.instructorId) {
      return res.status(400).send("unauthorized");
    }
    const { video } = req.files;
    // console.log(video);
    if (!video) return res.status(400).send("No video");

    // video params
    const params = {
      Bucket: "youdemy-bucket",
      Key: `${nanoid()}.${video.type.split("/")[1]}`,
      Body: fs.readFileSync(video.path),
      ACL: "public-read",
      ContentType: video.type,
    };

    // upload to S3
    S3.upload(params, (err, data) => {
      if (err) {
        console.log("Error from S3 upload video =>", err);
        res.sendStatus(400);
      }
      // console.log(data);
      res.send(data);
    });
  } catch (e) {
    console.log(
      "Error from server/controler/course uploadVideo function's catch =>",
      e
    );
  }
};
export const removeVideo = async (req, res) => {
  if (req.auth._id != req.params.instructorId) {
    return res.status(400).send("unauthorized");
  }
  try {
    const { Bucket, Key } = req.body;
    // console.log(video);

    // video params
    const params = {
      Bucket: Bucket,
      Key: Key,
    };

    // upload to S3
    S3.deleteObject(params, (err, data) => {
      if (err) {
        console.log("Error from S3 upload video =>", err);
        res.sendStatus(400);
      }
      console.log(data);
      res.send({ ok: true });
    });
  } catch (e) {
    console.log(
      "Error from server/controler/course deleteVideo function's catch =>",
      e
    );
  }
};

export const addLesson = async (req, res) => {
  try {
    const { slug, instructorId } = req.params;
    const { title, content, video } = req.body;
    const { Location, Bucket, Key, ETag } = video;
    if (req.auth._id != instructorId) {
      return res.status(400).send("unauthorized");
    }
    const updated = await Course.findOneAndUpdate(
      { slug },
      {
        $push: { lessons: { title, video, content, slug: slugify(title) } },
      },
      { new: true }
    )
      .populate("instructor", "_id name")
      .exec();
    res.json(updated);
  } catch (e) {
    console.log("Error from server/controllers/course addLesson catch => :", e);
    return res.status(400).send("Add lesson failed");
  }
};

export const update = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(req.body);
    const course = await Course.findOne({ slug }).exec();
    // console.log("course found", course);
    if (req.auth._id != course.instructor) {
      return res.status(400).send("Unauthorized");
    }
    const updated = await Course.findOneAndUpdate({ slug }, req.body, {
      new: true,
    }).exec();
    res.json(updated);
  } catch (e) {
    console.log("Error from server/controllers/course update =>", e);
    return res.status(400).send(e.message);
  }
};

export const removeLesson = async (req, res) => {
  try {
    const { slug, lessonId } = req.params;

    const course = await Course.findOne({ slug }).exec();
    if (req.auth._id != course.instructor) {
      return res.status(400).send("Unauthorized");
    }

    const deletedCourse = await Course.findByIdAndUpdate(course._id, {
      $pull: { lessons: { _id: lessonId } },
    });

    res.json({ ok: true });
  } catch (e) {
    console.log("Error from removeLesson =>", e);
  }
};

export const updateLesson = async (req, res) => {
  try {
    // console.log(req.body);
    const { slug } = req.params;
    const { _id, title, content, video, free_preview } = req.body;
    const course = await Course.findOne({ slug }).select("instructor").exec();
    if (req.auth._id != course.instructor) {
      return res.status(400).send("Unauthorized");
    }

    const updated = await Course.updateOne(
      {
        "lessons._id": _id,
      },
      {
        $set: {
          "lessons.$.title": title,
          "lessons.$.content": content,
          "lessons.$.video": video,
          "lessons.$.free_preview": free_preview,
        },
      },
      { new: true }
    ).exec();
    console.log("updated", updated);
    res.json({ ok: true });
  } catch (e) {
    console.log("Error from server/controllers/course updateLesson =>", e);
    return res.status(400).send("update lesson failed");
  }
};

export const publishCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).select("instructor").exec();

    if (req.auth._id != course.instructor) {
      return res.status(400).send("Unauthorized");
    }

    const updated = await Course.findByIdAndUpdate(
      courseId,
      {
        published: true,
      },
      { new: true }
    ).exec();
    res.json(updated);
  } catch (e) {
    console.log("Error from server/controllers/course publishCourse =>", e);
    return res.status(400).send("Publish course failed");
  }
};

export const unpublishCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).select("instructor").exec();

    if (req.auth._id != course.instructor) {
      return res.status(400).send("Unauthorized");
    }

    const updated = await Course.findByIdAndUpdate(
      courseId,
      {
        published: false,
      },
      { new: true }
    ).exec();
    res.json(updated);
  } catch (e) {
    console.log("Error from server/controllers/course unpublishCourse =>", e);
    return res.status(400).send("Unublish course failed");
  }
};

export const courses = async (req, res) => {
  const all = await Course.find({ published: true })
    .populate("instructor", "_id name")
    .exec();
  res.json(all);
};

export const checkEnrollment = async (req, res) => {
  const { courseId } = req.params;

  // find courses of the currently logged in user
  const user = await User.findById(req.auth._id).exec();

  // check if course id is found in user courses array
  let ids = [];
  let length = user.courses && user.courses.length;
  for (let i = 0; i < length; i++) {
    ids.push(user.courses[i].toString());
  }

  res.json({
    status: ids.includes(courseId),
    course: await Course.findById(courseId).exec(),
  });
};

export const freeEnrollment = async (req, res) => {
  try {
    // check if course is free or paid
    const course = await Course.findById(req.params.courseId).exec();
    if (course.paid) return;

    const result = await User.findByIdAndUpdate(
      req.auth._id,
      {
        $addToSet: { courses: course._id },
      },
      { new: true }
    ).exec();
    res.json({
      message: "Congratulations! You have successfully enrolled",
      course,
    });
  } catch (e) {
    console.log("error from server/controllers/course/freeEnrollment catch", e);
    return res.status(400).send("Enrollment create failed");
  }
};

export const paidEnrollment = async (req, res) => {
  try {
    // check if course is free of paid
    const course = await Course.findById(req.params.courseId)
      .populate("instructor")
      .exec();
    if (!course.paid) return;

    // application fee 30%
    const fee = (course.price * 30) / 100;

    // create stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      // purchase details
      line_items: [
        {
          name: course.name,
          amount: Math.round(course.price.toFixed(2) * 100),
          currency: "usd",
          quantity: 1,
        },
      ],

      // charge buyer and transfer remaining balance to seller (after fee )
      payment_intent_data: {
        application_fee_amount: Math.round(fee.toFixed(2) * 100),
        transfer_data: {
          destination: course.instructor.stripe_account_id,
        },
      },

      // redirect url after successful payment
      success_url: `${process.env.STRIPE_SUCCESS_URL}/${course._id}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
    });

    await User.findByIdAndUpdate(req.auth._id, {
      stripeSession: session,
    }).exec();
    res.send(session.id);
  } catch (e) {
    console.log("Error from server/controllers/course/paidEnrollment =>", e);
    return res.status(400).send("Enrollment create failed");
  }
};

export const stripeSuccess = async (req, res) => {
  try {
    // fint course
    const course = await Course.findById(req.params.courseId).exec();

    // get user from db to get stripe sessoin id
    const user = await User.findById(req.auth._id).exec();

    // if no stripe session return
    if (!user.stripeSession.id) return res.sendStatus(400);

    // retrive stripe session
    const session = await stripe.checkout.sessions.retrieve(
      user.stripeSession.id
    );

    // if session payemnt status is paid, push course to user's course array []
    if (session.payment_status === "paid") {
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { courses: course._id },
        $set: { stripeSession: {} },
      }).exec();
    }
    res.json({ success: true, course });
  } catch (e) {
    console.log("Error from server/controllers/course/stripeSuccess =>", e);
    return res.json({ success: false });
  }
};

export const userCourses = async (req, res) => {
  try {
    const user = await User.findById(req.auth._id).exec();
    const courses = await Course.find({ _id: { $in: user.courses } })
      .populate("instructor", "_id name")
      .exec();
    res.json(courses);
  } catch (e) {
    console.log("Error from server/controllers/course/userCourses =>", e);
    return res.status(400).send("Enrollment create failed");
  }
};

export const markCompleted = async (req, res) => {
  try {
    const { courseId, lessonId } = req.body;
    // console.log(courseId, lessonId);

    // find if user with that course is already created
    const existing = await Completed.findOne({
      user: req.auth._id,
      course: courseId,
    }).exec();
    if (existing) {
      // update
      const updated = await Completed.findOneAndUpdate(
        {
          user: req.auth._id,
          course: courseId,
        },
        {
          $addToSet: { lessons: lessonId },
        }
      ).exec();
      res.json({ ok: true });
    } else {
      // create
      const created = await new Completed({
        user: req.auth._id,
        course: courseId,
        lessons: lessonId,
      }).save();
      res.json({ ok: true });
    }
  } catch (e) {
    console.log("Error from server/controllers/course/markCompleted =>", e);
    return res.status(400).send("Enrollment create failed");
  }
};

/* 
export const markCompleted = async (req, res) => {
  try {
  } catch (e) {
    console.log("Error from server/controllers/course/markCompleted =>", e);
    return res.status(400).send("Enrollment create failed")
  }
}; 
*/
