module.exports = (req, res, next) => {
    const token = req.headers['authorization'];

    if (token === 'Bearer my-secret-token') {
        next(); // Authorized
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};