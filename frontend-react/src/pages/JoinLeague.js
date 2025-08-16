import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Crown, Users, Mail, Clock, AlertCircle, CheckCircle, Shield, ArrowRight, User, Lock, Eye, EyeOff, ArrowLeft, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, leaguesAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';

const JoinLeague = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, signIn, signUp, logout } = useAuth();

    // State management for invitation flow
    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authValidated, setAuthValidated] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [message, setMessage] = useState('');
    const [step, setStep] = useState('verification'); // Initial step

    // Form states for signup/verification
    const [signupData, setSignupData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        favoriteTeam: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get token from URL
    const token = searchParams.get('token');

    // MLB Teams for dropdown (used in signup form)
    const mlbTeams = [
        'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
        'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
        'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
        'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
        'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
        'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
        'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
        'Toronto Blue Jays', 'Washington Nationals'
    ];

    // ✅ NEW: Properly validate authentication status with backend
    const validateAuthStatus = async () => {
        console.log("JoinLeague: Validating authentication status with backend...");
        try {
            const response = await authAPI.checkAuth();
            console.log("JoinLeague: Auth status response:", response);
            
            if (response.authenticated) {
                console.log("JoinLeague: User is authenticated with backend");
                return true;
            } else {
                console.log("JoinLeague: User is NOT authenticated with backend, clearing auth state");
                // Safe logout call - only if logout is a function
                if (typeof logout === 'function') {
                    logout();
                } else {
                    console.warn("JoinLeague: logout is not a function, skipping logout call");
                }
                return false;
            }
        } catch (error) {
            console.log("JoinLeague: Auth status check failed, assuming not authenticated:", error);
            // Safe logout call - only if logout is a function
            if (typeof logout === 'function') {
                logout();
            } else {
                console.warn("JoinLeague: logout is not a function, skipping logout call");
            }
            return false;
        }
    };

    // Effect to verify invitation token and validate authentication
    useEffect(() => {
        const initializeFlow = async () => {
            console.log("JoinLeague: Initializing flow - verifying invitation and auth status");
            
            if (!token) {
                setError('Invalid invitation link. Please check your email and try again.');
                setLoading(false);
                return;
            }

            try {
                // STEP 1: Verify invitation token (public endpoint)
                console.log("JoinLeague: Step 1 - Verifying invitation token");
                const invitationResponse = await leaguesAPI.verifyInvitation(token);
                console.log("JoinLeague: Invitation verification response:", invitationResponse);
                
                if (!invitationResponse.success) {
                    setError(invitationResponse.message || 'Invalid or expired invitation.');
                    setLoading(false);
                    return;
                }

                // Set invitation data and pre-fill form
                setInvitation(invitationResponse.invitation);
                
                const invitedEmail = invitationResponse.invitation?.email || '';
                const invitedOwnerName = invitationResponse.invitation?.owner_name || '';
                let prefillFirstName = '';
                let prefillLastName = '';

                // Parse owner_name into first and last name
                const nameParts = invitedOwnerName.split(' ').filter(part => part.trim() !== '');
                if (nameParts.length > 0) {
                    prefillFirstName = nameParts[0];
                    if (nameParts.length > 1) {
                        prefillLastName = nameParts.slice(1).join(' ');
                    }
                }

                setSignupData(prev => ({ 
                    ...prev, 
                    email: invitedEmail,
                    firstName: prefillFirstName,
                    lastName: prefillLastName
                }));

                // STEP 2: Validate authentication status with backend
                console.log("JoinLeague: Step 2 - Validating authentication status");
                const isAuthenticated = await validateAuthStatus();
                setAuthValidated(true);

                // STEP 3: Determine next step based on VALIDATED auth status
                if (isAuthenticated) {
                    console.log("JoinLeague: User is authenticated, showing join screen");
                    setStep('authenticated');
                } else {
                    console.log("JoinLeague: User is not authenticated, showing signup screen");
                    setStep('signup');
                }

            } catch (err) {
                console.error('JoinLeague: Initialization error:', err);
                setError(err.response?.data?.detail || 'Failed to verify invitation. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        // Only run initialization once
        if (!authValidated) {
            initializeFlow();
        }
    }, [token, authValidated]);

    // ✅ FIXED: Listen to user changes after auth validation
    useEffect(() => {
        // Only respond to user changes after we've validated auth status
        if (authValidated && invitation) {
            if (user && step !== 'authenticated') {
                console.log("JoinLeague: User logged in after initial load, updating step to authenticated");
                setStep('authenticated');
            } else if (!user && step === 'authenticated') {
                console.log("JoinLeague: User logged out, updating step to signup");
                setStep('signup');
            }
        }
    }, [user, authValidated, invitation, step]);

    // Handle signup form submission
    const handleSignup = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setSuccess('');
        setMessage('');
        console.log("JoinLeague: Attempting signup with formData:", signupData);

        // Basic frontend password match check
        if (signupData.password !== signupData.confirmPassword) {
            setError('Passwords do not match.');
            setIsSubmitting(false);
            return;
        }

        try {
            const result = await signUp(signupData);
            console.log("JoinLeague: Signup result:", result);

            if (result.success) {
                setMessage('Account created! Please check your email for verification.');
                setStep('email_verification');
            } else {
                setError(result.error || 'Account creation failed. Please try again.');
            }
        } catch (err) {
            console.error('JoinLeague: Signup error:', err);
            setError(err.response?.data?.detail || 'Account creation failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle email verification
    const handleEmailVerification = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setSuccess('');
        setMessage('');
        console.log("JoinLeague: Attempting email verification for:", signupData.email);

        try {
            const response = await authAPI.verifyEmail(signupData.email, verificationCode);
            console.log("JoinLeague: Verify Email API response:", response);

            if (response.success) {
                setSuccess('Email verified! Attempting auto-login...');
                console.log("JoinLeague: Email verified, attempting auto-login.");
                
                try {
                    const loginResult = await signIn(signupData.email, signupData.password);
                    if (loginResult.success) {
                        setSuccess('Successfully signed in! You can now join the league.');
                        console.log("JoinLeague: Auto-login successful. User is now authenticated.");
                        // The useEffect will detect the user change and update step
                    } else {
                        setError(loginResult.error || 'Verification successful, but auto-login failed. Please login manually to continue joining the league.');
                        console.error("JoinLeague: Auto-login failed:", loginResult.error);
                    }
                } catch (loginErr) {
                    console.error('JoinLeague: Auto-login error:', loginErr);
                    setError('Verification successful, but auto-login failed. Please login manually to continue joining the league.');
                }
            } else {
                setError(response.message || 'Email verification failed. Please check your code and try again.');
                console.error("JoinLeague: Email verification API failed:", response.message);
            }
        } catch (err) {
            console.error('JoinLeague: Email verification error:', err);
            setError(err.response?.data?.detail || 'Email verification failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Resend verification email
    const handleResendVerification = async () => {
        setIsSubmitting(true);
        setError('');
        setSuccess('');
        setMessage('');
        console.log("JoinLeague: Resending verification email for:", signupData.email);

        try {
            const response = await authAPI.resendVerification(signupData.email);
            console.log("JoinLeague: Resend verification API response:", response);
            if (response.success) {
                setMessage('Verification email resent! Please check your inbox.');
            } else {
                setError(response.message || 'Failed to resend verification email.');
            }
        } catch (err) {
            console.error('JoinLeague: Resend verification error:', err);
            setError(err.response?.data?.detail || 'Failed to resend verification email.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle invitation acceptance
    const handleAcceptInvitation = async () => {
        setIsSubmitting(true);
        setError('');
        setSuccess('');
        setMessage('');
        console.log("JoinLeague: Attempting to accept invitation for token:", token);

        // ✅ ADDED: Re-validate auth before accepting invitation
        console.log("JoinLeague: Re-validating authentication before accepting...");
        const isStillAuthenticated = await validateAuthStatus();
        
        if (!isStillAuthenticated) {
            setError('Your session has expired. Please log in again to join the league.');
            setStep('signup');
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await leaguesAPI.acceptInvitation(token);
            console.log("JoinLeague: Accept invitation API response:", response);
            
            if (response.success) {
                setSuccess('Successfully joined the league! Redirecting to your league dashboard...');
                console.log("JoinLeague: Successfully joined league. Navigating to:", `/leagues/${invitation.league_id}`);
                
                setTimeout(() => {
                    navigate(`/leagues/${invitation.league_id}`);
                }, 2000);
            } else {
                setError(response.message || 'Failed to join league. Please try again.');
                console.error("JoinLeague: Accept invitation API failed:", response.message);
            }
        } catch (err) {
            console.error('JoinLeague: Accept invitation error:', err);
            
            // Check if it's an authentication error
            if (err.response?.status === 401 || err.response?.status === 403) {
                setError('Your session has expired. Please log in again to join the league.');
                // Safe logout call - only if logout is a function
                if (typeof logout === 'function') {
                    logout();
                } else {
                    console.warn("JoinLeague: logout is not a function, skipping logout call");
                }
                setStep('signup');
            } else {
                setError(err.response?.data?.detail || err.message || 'An unexpected error occurred during joining the league.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSignupData(prev => ({ ...prev, [name]: value }));
    };

    // Styling classes
    const inputClass = `${dynastyTheme.components.input} w-full`;
    const buttonPrimaryClass = `${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} w-full flex items-center justify-center`;
    const buttonSecondaryClass = `${dynastyTheme.utils.getComponent('button', 'secondary', 'lg')} w-full flex items-center justify-center`;
    const iconClass = `h-5 w-5 mr-2`;
    const spinnerClass = `animate-spin rounded-full h-5 w-5 border-b-2 ${dynastyTheme.classes.text.black} mr-2`;
    const messageSuccessClass = `${dynastyTheme.classes.bg.success}/20 border ${dynastyTheme.classes.border.success} rounded-lg p-4 mb-6 ${dynastyTheme.classes.text.white} flex items-center`;
    const messageErrorClass = `${dynastyTheme.classes.bg.error}/20 border ${dynastyTheme.classes.border.error} rounded-lg p-4 mb-6 ${dynastyTheme.classes.text.white} flex items-center`;
    const containerClass = `${dynastyTheme.components.card.base} p-8 max-w-2xl w-full`;
    const headerClass = `text-center mb-8`;
    const iconCenterClass = `h-12 w-12 ${dynastyTheme.classes.text.primary} mx-auto mb-4`;
    const headingClass = `text-3xl font-bold ${dynastyTheme.classes.text.white}`;
    const subHeadingClass = `text-2xl font-semibold ${dynastyTheme.classes.text.white} mb-2`;
    const paragraphClass = `${dynastyTheme.classes.text.neutralLight} mb-6`;
    const labelClass = `block text-sm font-medium ${dynastyTheme.classes.text.neutralLighter} mb-1`;
    const buttonGhostClass = `${dynastyTheme.classes.text.neutralLighter} hover:${dynastyTheme.classes.text.white} text-sm flex items-center justify-center mx-auto`;
    const iconInputRight = `absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 ${dynastyTheme.classes.text.neutralLighter} cursor-pointer hover:${dynastyTheme.classes.text.white}`;

    // Loading state (while verifying token and auth status)
    if (loading) {
        return (
            <div className={`${dynastyTheme.components.page} flex items-center justify-center`}>
                <div className={`${dynastyTheme.components.card.base} p-8 max-w-md w-full`}>
                    <div className="text-center">
                        <div className={`${spinnerClass.replace('mr-2', 'mx-auto')} h-12 w-12 border-b-2 ${dynastyTheme.classes.text.primary}`} />
                        <p className={`${dynastyTheme.classes.text.neutralLight} mt-4`}>Verifying invitation and authentication...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state (invalid/expired invitation detected initially)
    if (error && !invitation) {
        return (
            <div className={`${dynastyTheme.components.page} flex items-center justify-center`}>
                <div className={`${dynastyTheme.components.card.base} p-8 max-w-md w-full text-center`}>
                    <AlertCircle className={`h-16 w-16 ${dynastyTheme.classes.text.error} mx-auto mb-4`} />
                    <h2 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white} mb-2`}>Invalid Invitation</h2>
                    <p className={`${dynastyTheme.classes.text.neutralLight} mb-6`}>{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')}`}
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    // Main render based on current step
    return (
        <div className={`${dynastyTheme.components.page} flex items-center justify-center p-4`}>
            <div className={containerClass}>
                {/* Header */}
                <div className={headerClass}>
                    <Crown className={iconCenterClass} />
                    <h1 className={headingClass}>Dynasty Dugout</h1>
                </div>

                {/* Invitation Details */}
                {invitation && (
                    <div className={`${dynastyTheme.components.card.base} p-6 mb-6`}>
                        <h2 className={`${dynastyTheme.components.heading.h3} ${dynastyTheme.classes.text.white} mb-4`}>League Invitation</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center">
                                <Mail className={`h-5 w-5 ${dynastyTheme.classes.text.primary} mr-2`} />
                                <div>
                                    <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Invited By</p>
                                    <p className={dynastyTheme.classes.text.white}>{invitation.commissioner_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <Clock className={`h-5 w-5 ${dynastyTheme.classes.text.warning} mr-2`} />
                                <div>
                                    <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Expires</p>
                                    <p className={dynastyTheme.classes.text.white}>
                                        {new Date(invitation.expires_at).toLocaleDateString()} at {new Date(invitation.expires_at).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {invitation.personal_message && (
                            <div className={`mt-4 p-4 ${dynastyTheme.classes.bg.darkLighter} rounded-lg`}>
                                <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Personal Message</p>
                                <p className={dynastyTheme.classes.text.white}>{invitation.personal_message}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                    <div className={messageErrorClass}>
                        <AlertCircle className={`h-5 w-5 ${dynastyTheme.classes.text.error} mr-2`} />
                        <span className={dynastyTheme.classes.text.white}>{error}</span>
                    </div>
                )}
                {success && (
                    <div className={messageSuccessClass}>
                        <CheckCircle className={`h-5 w-5 ${dynastyTheme.classes.text.success} mr-2`} />
                        <span className={dynastyTheme.classes.text.white}>{success}</span>
                    </div>
                )}
                {message && (
                    <div className={`${dynastyTheme.classes.bg.info}/20 border ${dynastyTheme.classes.border.info} rounded-lg p-4 mb-6 ${dynastyTheme.classes.text.white} flex items-center`}>
                        <Mail className={`h-5 w-5 ${dynastyTheme.classes.text.info} mr-2`} />
                        <span className={dynastyTheme.classes.text.white}>{message}</span>
                    </div>
                )}

                {/* Step Content */}
                {step === 'signup' && (
                    <div>
                        <h2 className={subHeadingClass}>
                            You're invited to join {invitation?.league_name}!
                        </h2>
                        <p className={paragraphClass}>Create an account to join this league:</p>
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>
                                        First Name *
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={signupData.firstName}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>
                                        Last Name *
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={signupData.lastName}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={signupData.email}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                    required
                                />
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Password *
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={signupData.password}
                                        onChange={handleInputChange}
                                        className={`${inputClass} pr-10`}
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className={iconInputRight}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
                                    Must be at least 8 characters with uppercase, lowercase, and numbers
                                </p>
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Confirm Password *
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        name="confirmPassword"
                                        value={signupData.confirmPassword}
                                        onChange={handleInputChange}
                                        className={`${inputClass} pr-10`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className={iconInputRight}
                                    >
                                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Favorite Team
                                </label>
                                <select
                                    name="favoriteTeam"
                                    value={signupData.favoriteTeam}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                >
                                    <option value="">Select a team...</option>
                                    {mlbTeams.map(team => (
                                        <option key={team} value={team}>{team}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={buttonPrimaryClass}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className={spinnerClass}></div>
                                        Creating Account...
                                    </>
                                ) : (
                                    <>
                                        <User className={iconClass} />
                                        Create Account
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {step === 'email_verification' && (
                    <div>
                        <div className="text-center mb-6">
                            <Mail className={iconCenterClass} />
                            <h2 className={subHeadingClass}>Check Your Email</h2>
                            <p className={`${dynastyTheme.classes.text.neutralLight}`}>
                                We've sent a verification code to <strong>{signupData.email}</strong>
                            </p>
                        </div>
                        <form onSubmit={handleEmailVerification} className="space-y-4">
                            <div>
                                <label className={labelClass}>
                                    Verification Code *
                                </label>
                                <input
                                    type="text"
                                    name="verificationCode"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    className={`${inputClass} text-center text-lg tracking-widest`}
                                    placeholder="000000"
                                    maxLength="6"
                                    required
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setStep('signup')}
                                    className={`${buttonSecondaryClass} flex-1`}
                                >
                                    <ArrowLeft className={iconClass} />
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`${buttonPrimaryClass} flex-1`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className={spinnerClass}></div>
                                            Verifying...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className={iconClass} />
                                            Verify Email
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                        <div className="text-center mt-6">
                            <button
                                onClick={handleResendVerification}
                                disabled={isSubmitting}
                                className={buttonGhostClass}
                            >
                                <RotateCcw className={`h-4 w-4 ${dynastyTheme.classes.text.neutralLighter} mr-1`} />
                                Resend Code
                            </button>
                        </div>
                    </div>
                )}

                {step === 'authenticated' && (
                    <div>
                        <div className="text-center mb-6">
                            <Shield className={iconCenterClass} />
                            <h2 className={subHeadingClass}>Ready to Join!</h2>
                            <p className={`${dynastyTheme.classes.text.neutralLight}`}>
                                Welcome {user?.given_name || user?.firstName || 'back'}! You're all set to join {invitation?.league_name}.
                            </p>
                        </div>
                        <div className="text-center mb-6">
                            <div className={`inline-flex items-center ${dynastyTheme.classes.bg.success}/20 border ${dynastyTheme.classes.border.success} rounded-lg px-4 py-2 mb-4`}>
                                <CheckCircle className={`h-5 w-5 ${dynastyTheme.classes.text.success} mr-2`} />
                                <span className={`${dynastyTheme.classes.text.white} font-medium`}>Secure Invitation</span>
                            </div>
                            <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
                                This invitation link is secure and will be permanently consumed once you join.
                            </p>
                        </div>
                        <button
                            onClick={handleAcceptInvitation}
                            disabled={isSubmitting}
                            className={buttonPrimaryClass}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className={spinnerClass}></div>
                                    Joining League...
                                </>
                            ) : (
                                <>
                                    <Users className={iconClass} />
                                    Join {invitation?.league_name}
                                    <ArrowRight className={iconClass} />
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JoinLeague;