const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const Razorpay = require("razorpay");
const firebase = require("firebase/app");
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL, listAll } = require('firebase/storage');
require("dotenv").config();
const nodemailer = require("nodemailer");

const corsConfig = {
    origin: "*",
    credential: true,
    methods: ["GET", "POST", "DELETE", "PUT"]
}
app.options("", cors(corsConfig))
app.use(express.json());
app.use(cors(corsConfig));
app.use(express.urlencoded({ extended: false }));


//moongose connection
mongoose.connect("mongodb+srv://hbhavsar847:Harshal2004@cluster0.wldqsom.mongodb.net/e-commerce");

//api
app.get("/", (res) => {

    res.send("hello world")
})


// Initialize Firebase with your config
const firebaseConfig = {
    apiKey: "AIzaSyDA-z_VGa8JUyft5fjrQtaZEVtSNVr5dj4",
    authDomain: "tejaswinisales2.firebaseapp.com",
    projectId: "tejaswinisales2",
    storageBucket: "tejaswinisales2.appspot.com",
    messagingSenderId: "468327149328",
    appId: "1:468327149328:web:4d2631c430faf5fddebf95",
    measurementId: "G-ZSH9RGRLGD"
};
const harsh = initializeApp(firebaseConfig);
const imageDb = getStorage(harsh);



const ProductSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    },
});

const Product = mongoose.model('Product', ProductSchema);

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route to handle image upload
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        const file = req.file;

        // Upload image to Firebase Storage
        const storageRef = ref(imageDb, file.originalname);
        await uploadBytes(storageRef, file.buffer);

        // Get download URL
        const imageUrl = await getDownloadURL(storageRef);

        let products = await Product.find({});
        let id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

        // Save details to MongoDB
        const product = new Product({
            id: id,
            name: req.body.name,
            image: imageUrl, // Assign the fetched image URL
            category: req.body.category,
            new_price: req.body.new_price,
            old_price: req.body.old_price,
        });
        await product.save();

        res.status(200).json({ message: 'Image uploaded successfully', imageUrl: imageUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});




//creating API for deleting product

app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("remote");
    res.json({
        success: true,
        name: req.body.name
    })
})

//creating API for getting all products
app.get('/allproducts', async (req, res) => {

    let products = await Product.find({})
    console.log("all products Fetched");
    res.send(products);
})


// Schema creating for user model

const Users = mongoose.model('Users', {
    name: {
        type: String
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now,
    }
})

// creating endpoint for registering the user
app.post('/signup', async (req, res) => {
    let check = await Users.findOne({ email: req.body.email });
    if (check) {
        return res.status(400).json({ success: false, errors: "existing use found with the same username" })
    }
    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0;

    }
    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    })

    await user.save();

    const data = {
        user: {
            id: user.id
        }
    }

    const token = jwt.sign(data, 'secret_ecom');
    res.json({ success: true, token })
})

// creating end point for the user login
app.post('/login', async (req, res) => {
    let user = await Users.findOne({ email: req.body.email });
    if (user) {
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = {
                user: {
                    id: user.id
                }
            }
            const token = jwt.sign(data, 'secret_ecom');
            res.json({ success: true, token });
        }
        else {
            res.json({ success: false, errors: "wrong password" })
        }
    }
    else {
        res.json({ success: false, errors: "wrong email id" })
    }
})

//creating endpoint for newcollection data
app.get('/newcollections', async (req, res) => {
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("newcollection fetched");
    res.send(newcollection);
})


//creating end point for the popular
app.get("/popularinwomen", async (req, res) => {
    let products = await Product.find({ category: { $in: ["50", "55", "43"] } });
    let popular_in_women = products.slice(0.4);
    console.log("popular in women Fetched");
    res.send(popular_in_women);
})

//creaing middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        return res.status(401).send({ errors: "Please authenticate using a valid token" });
    } else {
        try {
            const data = jwt.verify(token, 'secret_ecom');
            req.user = data.user;
            next(); // Pass control to the next middleware function
        } catch (error) {
            return res.status(401).send({ errors: "Please authenticate using a valid token" });
        }
    }
}


app.post('/addtocart', fetchUser, async (req, res) => {
    console.log("Added", req.body.itemId);

    try {
        let userData = await Users.findOne({ _id: req.user.id });
        if (!userData) {
            return res.status(404).send({ errors: "User not found" });
        }

        // Assuming cartData is an object with itemIds as keys and quantities as values
        userData.cartData[req.body.itemId] += 1;

        await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });

        res.send("Added");
    } catch (error) {
        console.error(error);
        res.status(500).send({ errors: "Internal Server Error" });
    }
});

// GET endpoint to fetch all user data
app.get('/users', async (req, res) => {
    try {
        let allUserData = await Users.find();
        res.send(allUserData);
    } catch (error) {
        console.error(error);
        res.status(500).send({ errors: "Internal Server Error" });
    }
});

// creating endpoint to remove product from cart data
app.post('/removefromcart', fetchUser, async (req, res) => {
    console.log("removed", req.body.itemId);
    let userData = await Users.findOne({ _id: req.user.id });
    if (userData.cartData[req.body.itemId] > 0)
        userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send("removed")
})


//creating endpoint for the storage
app.post('/getcart', fetchUser, async (req, res) => {
    console.log("Getcart");
    let userData = await Users.findOne({ _id: req.user.id });
    res.json(userData.cartData);

})


// creating endpoint for the razorpay
const orderSchema = new mongoose.Schema({
    razorpay_order_id: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    amount_paid: {
        type: Number,
        required: true
    },
    amount_due: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true
    },
    // Add other fields as needed
});

// Create a Mongoose model
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
// Define a Mongoose schema for the order data
// Endpoint to create a new order
app.post('/orders', async (req, res) => {
    try {
        const razorpay = new Razorpay({
            key_id: "rzp_test_Y8KhYysnUCd19c",
            key_secret: "DU0kkawBgmGuBMIubMd6KMHj",
        });

        const options = req.body;
        const order = await razorpay.orders.create(options);

        if (!order) {
            return res.status(300).send("Error");
        }

        // Save order data to MongoDB
        const newOrder = new Order({
            razorpay_order_id: order.id,
            amount: order.amount,
            amount_paid: order.amount_paid,
            amount_due: order.amount_due,
            currency: order.currency,
            // Add other fields as needed
        });

        await newOrder.save();
        res.json(order);
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).send("Error creating order");
    }
});

app.post('/razorpay-webhook', (req, res) => {
    // Process the payload (e.g., update database, send email)
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: "tejaswinisales8@gmail.com",
            pass: "vkvqccajbbtofhst",
        }
    });

    const mailOptions = {
        from: 'tejaswinisales8@gmail.com',
        to: "hbhavsar847@gmail.com",
        subject: 'Order Confirmation',
        html: `<h1>Thank you for your order!</h1>
            <p>Your order details:</p>
            <ul>
                <h1>Thanks For the Order get help from the TejaswiniSales at</h1>
                <a href="www.tejaswinisales.shop"><p>Contact from here</p></a>
            </ul>
            <p>We will process your order shortly.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ message: 'Error sending email' });
        } else {
            console.log('Email sent:', info.response);
            return res.status(200).json({ message: 'Email sent successfully' });
        }
    });


    // Send acknowledgment response
    res.status(200).send('Webhook received successfully');
});

app.get('/orders', async (req, res) => {
    try {
        // Fetch all orders from MongoDB
        const orders = await Order.find().lean();

        // Send the orders as JSON response
        res.json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Error fetching orders");
    }
});

// Delete order by ID
app.delete('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedOrder = await Order.findByIdAndDelete(id);
        if (!deletedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).send("Error deleting order");
    }
});


// Endpoint to receive data
app.post('/submit-data', (req, res) => {
    const data = req.body;
    console.log('Received data:', data);
    // Here you can process the received data, such as saving it to a database
    res.status(200).json({ message: 'Data received successfully' });
});


// Define a schema for the contact form data
const contactSchema = new mongoose.Schema({
    name: String,
    phone: String,
    email: String
});

// Create a model based on the schema
const Contact = mongoose.model('Contact', contactSchema);

// POST endpoint to handle form submission
app.post('/api/submitForm', async (req, res) => {
    try {
        // Extract form data from the request body
        const { name, phone, email } = req.body;

        // Create a new contact document
        const newContact = new Contact({ name, phone, email });

        // Save the contact document to the database
        await newContact.save();

        // Respond with a success message
        res.status(201).json({ message: 'Form submitted successfully' });
    } catch (error) {
        console.error('Error submitting form:', error);
        // Respond with an error message
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET endpoint to fetch all contact form submissions
app.get('/api/contactFormSubmissions', async (req, res) => {
    try {
        // Fetch all contact form submissions from the database
        const submissions = await Contact.find();

        // Respond with the fetched submissions
        res.status(200).json(submissions);
    } catch (error) {
        console.error('Error fetching contact form submissions:', error);
        // Respond with an error message
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Endpoint to delete a contact form submission by ID
app.delete('/api/contactFormSubmissions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Find the submission by ID and delete it
        await Contact.findByIdAndDelete(id);
        res.status(200).json({ message: 'Submission deleted successfully' });
    } catch (error) {
        console.error('Error deleting contact form submission:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

const bodyParser = require('body-parser');
// Middleware
app.use(bodyParser.json());


const Review = mongoose.model('Review', {
    name: String,
    email: String,
    text: String,
    rating: Number,
    date: Date
});

// Endpoint to get reviews
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await Review.find();
        res.json(reviews);
    } catch (err) {
        console.error('Error fetching reviews', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to add a review
app.post('/api/reviews', async (req, res) => {
    try {
        const { name, email, text, rating, date } = req.body;
        const review = new Review({ name, email, text, rating, date });
        await review.save();
        res.status(201).json(review);
    } catch (err) {
        console.error('Error adding review', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Endpoint to delete a review by ID
app.delete('/api/reviews/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedReview = await Review.findByIdAndDelete(id);
        if (!deletedReview) {
            return res.status(404).json({ error: 'Review not found' });
        }
        res.json({ message: 'Review deleted successfully' });
    } catch (err) {
        console.error('Error deleting review', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, (error) => {
    if (!error) {
        console.log("server is running on" + port)
    }
    else {
        console.log("Error" + error)
    }
})
