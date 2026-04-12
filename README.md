# OneDelivery Backend API

Scalable, production-ready backend API for OneDelivery.com clone - built with Node.js, Express, and MongoDB.

## Architecture

This backend follows a **multi-layer, scalable architecture** designed to handle **50,000+ concurrent users**:

```
backend/
├── config/              # Configuration files
│   ├── constants.js     # Application constants
│   └── database.js      # Database connection
├── controllers/         # Request/Response handlers (Thin layer)
│   ├── auth.controller.js
│   └── index.js
├── services/            # Business logic layer (Reusable)
│   ├── auth.service.js
│   ├── thirdPartyAPI.service.js
│   └── index.js
├── validators/          # Input validation rules
│   ├── auth.validator.js
│   └── index.js
├── middleware/          # Custom middleware
│   ├── auth.middleware.js
│   ├── validate.middleware.js
│   └── errorHandler.middleware.js
├── models/              # Database models (MongoDB/Mongoose)
│   ├── User.model.js
│   └── Wallet.model.js
├── routes/              # Route definitions (Thin layer)
│   └── auth.routes.js
├── utils/               # Utility functions
│   ├── AppError.js
│   ├── generateToken.js
│   └── responseHandler.js
└── server.js            # Application entry point
```

## Architecture Principles

### 1. **Separation of Concerns**
- **Routes**: Only route definitions, no business logic
- **Controllers**: Handle HTTP request/response, delegate to services
- **Services**: Contains all business logic (reusable across controllers)
- **Validators**: Input validation rules separate from business logic
- **Models**: Database schema and model methods only

### 2. **Scalability Features**
- ✅ Service layer allows logic reuse across multiple endpoints
- ✅ Middleware-based validation (can be cached)
- ✅ Error handling centralized in middleware
- ✅ Third-party API abstraction layer for easy integration
- ✅ Database connection pooling (Mongoose default)
- ✅ Environment-based configuration

### 3. **Best Practices**
- ✅ Consistent error handling with custom AppError class
- ✅ Standardized API response format
- ✅ Input validation before processing
- ✅ JWT authentication with middleware
- ✅ Request size limits for security
- ✅ Graceful error handling and logging

## Project Structure Details

### Routes Layer (`routes/`)
**Purpose**: Define API endpoints only

```javascript
// Example: routes/auth.routes.js
router.post('/signup', signupValidation, validate, authController.signup);
```

### Controllers Layer (`controllers/`)
**Purpose**: Handle HTTP request/response, call services

```javascript
// Example: controllers/auth.controller.js
async signup(req, res, next) {
  const result = await authService.signup(req.body);
  return successResponse(res, result, 'User registered', 201);
}
```

### Services Layer (`services/`)
**Purpose**: Business logic - reusable across controllers

```javascript
// Example: services/auth.service.js
async signup(userData) {
  // Business logic here
  // Can be reused by other controllers
}
```

### Validators Layer (`validators/`)
**Purpose**: Input validation rules using express-validator

```javascript
// Example: validators/auth.validator.js
const signupValidation = [
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
];
```

### Middleware Layer (`middleware/`)
**Purpose**: Request processing, authentication, validation, error handling

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register new user
  - Validators: `signupValidation`
  - Controller: `authController.signup`
  - Service: `authService.signup`

- `POST /api/auth/login` - User login
  - Validators: `loginValidation`
  - Controller: `authController.login`
  - Service: `authService.login`

- `GET /api/auth/me` - Get current user (Protected)
  - Middleware: `protect`
  - Controller: `authController.getCurrentUser`
  - Service: `authService.getCurrentUser`

## Third-Party API Integration

The `thirdPartyAPIService` provides an abstraction layer for delivery partners:

- **FedEx** - Rate calculation, shipment creation, tracking
- **Blue Dart** - Rate calculation, shipment creation, tracking
- **Serviceability Check** - Pincode validation

### Usage Example:

```javascript
const { thirdPartyAPIService } = require('./services');
const { DELIVERY_PARTNERS } = require('./config/constants');

// Calculate rate
const rate = await thirdPartyAPIService.calculateRate(
  DELIVERY_PARTNERS.FEDEX,
  { from: '110001', to: '400001', weight: 1 }
);

// Create shipment
const shipment = await thirdPartyAPIService.createShipment(
  DELIVERY_PARTNERS.FEDEX,
  shipmentData
);
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file (copy from `env.example`):

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/onedelivery

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# CORS
FRONTEND_URL=http://localhost:3000

# Third-party APIs
FEDEX_API_KEY=your_fedex_api_key
FEDEX_API_SECRET=your_fedex_api_secret
FEDEX_API_BASE_URL=https://apis.fedex.com

BLUE_DART_API_KEY=your_blue_dart_api_key
BLUE_DART_API_SECRET=your_blue_dart_api_secret
BLUE_DART_API_BASE_URL=https://www.bluedart.com/api
```

### 3. Start MongoDB

Ensure MongoDB is running locally or use MongoDB Atlas.

### 4. Run the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server runs on `http://localhost:5000`

## Error Handling

The application uses a centralized error handler:

```javascript
// Custom error
throw new AppError('User not found', 404);

// Automatic handling for:
// - Mongoose validation errors
// - Duplicate key errors
// - JWT errors
// - Cast errors
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ] // Optional validation errors
}
```

## Scalability Considerations

### For 50,000+ Users:

1. **Database Indexing**: Ensure MongoDB indexes on frequently queried fields
2. **Caching**: Add Redis for session/token caching
3. **Load Balancing**: Use PM2 cluster mode or Kubernetes
4. **Rate Limiting**: Implement rate limiting middleware
5. **API Optimization**: Use MongoDB aggregation for complex queries
6. **Connection Pooling**: Mongoose handles this by default
7. **Error Logging**: Integrate with Sentry or similar
8. **Monitoring**: Add APM tools (New Relic, Datadog)

## Development Best Practices

1. **Always use services** - Don't put business logic in controllers
2. **Validate inputs** - Use validators before controllers
3. **Handle errors** - Use AppError for consistent error handling
4. **Reuse services** - Services are reusable across controllers
5. **Follow naming** - Controllers: `*.controller.js`, Services: `*.service.js`
6. **Test services** - Services can be unit tested independently

## Future Enhancements

- [ ] Order management service and controller
- [ ] Wallet service for transactions
- [ ] Webhook handling for order status updates
- [ ] Rate limiting middleware
- [ ] Request logging middleware
- [ ] Caching layer (Redis)
- [ ] Email notification service
- [ ] SMS notification service
- [ ] File upload service
- [ ] Unit and integration tests

## License

Private project
