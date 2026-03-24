"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAllPolls = exports.deleteComment = exports.deleteAllComments = exports.deletePoll = exports.addComment = exports.votePoll = exports.createPoll = exports.getPolls = void 0;
const Poll_1 = __importDefault(require("../models/Poll"));
const mongoose_1 = __importDefault(require("mongoose"));
// @desc    Get all polls
// @route   GET /api/polls
const getPolls = async (req, res) => {
    try {
        const polls = await Poll_1.default.find().sort({ createdAt: -1 });
        res.json(polls);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.getPolls = getPolls;
// @desc    Create a poll
// @route   POST /api/polls
const createPoll = async (req, res) => {
    try {
        const { question, options } = req.body;
        const pollOptions = options.map((text) => ({
            text,
            votes: 0,
            voters: []
        }));
        const poll = await Poll_1.default.create({
            question,
            options: pollOptions,
            createdBy: req.userId,
            votedUsers: []
        });
        res.status(201).json(poll);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.createPoll = createPoll;
// @desc    Vote on a poll (Allows vote change)
// @route   POST /api/polls/:id/vote
const votePoll = async (req, res) => {
    try {
        const { optionId } = req.body;
        const userId = req.userId; // ✅ Type assertion - red line fix
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }
        const poll = await Poll_1.default.findById(req.params.id);
        if (!poll) {
            res.status(404).json({ message: 'Poll not found' });
            return;
        }
        // Check if user already voted in this poll
        const hasVoted = poll.votedUsers && poll.votedUsers.some((id) => id.toString() === userId.toString());
        if (hasVoted) {
            // USER ALREADY VOTED - Remove previous vote
            let previousVoteOption = null;
            // Find which option user previously voted for
            for (let opt of poll.options) {
                if (opt.voters && opt.voters.some((id) => id.toString() === userId.toString())) {
                    previousVoteOption = opt;
                    break;
                }
            }
            // Remove previous vote
            if (previousVoteOption) {
                previousVoteOption.votes -= 1;
                previousVoteOption.voters = previousVoteOption.voters.filter((id) => id.toString() !== userId.toString());
            }
            // Add new vote
            const selectedOption = poll.options.find((opt) => opt._id?.toString() === optionId);
            if (!selectedOption) {
                res.status(404).json({ message: 'Option not found' });
                return;
            }
            selectedOption.votes += 1;
            if (!selectedOption.voters) {
                selectedOption.voters = [];
            }
            selectedOption.voters.push(new mongoose_1.default.Types.ObjectId(userId)); // ✅ Convert to ObjectId
            await poll.save();
            res.json({ message: 'Vote changed successfully', poll });
        }
        else {
            // FIRST TIME VOTING - Add new vote
            const selectedOption = poll.options.find((opt) => opt._id?.toString() === optionId);
            if (!selectedOption) {
                res.status(404).json({ message: 'Option not found' });
                return;
            }
            selectedOption.votes += 1;
            if (!selectedOption.voters) {
                selectedOption.voters = [];
            }
            selectedOption.voters.push(new mongoose_1.default.Types.ObjectId(userId)); // ✅ Convert to ObjectId
            // Add user to poll's votedUsers list
            if (!poll.votedUsers) {
                poll.votedUsers = [];
            }
            poll.votedUsers.push(new mongoose_1.default.Types.ObjectId(userId)); // ✅ Convert to ObjectId
            await poll.save();
            res.json({ message: 'Vote recorded successfully', poll });
        }
    }
    catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.votePoll = votePoll;
// @desc    Add comment to poll
// @route   POST /api/polls/:id/comment
const addComment = async (req, res) => {
    try {
        const { comment } = req.body;
        const userId = req.userId; // ✅ Type assertion
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }
        const poll = await Poll_1.default.findById(req.params.id);
        if (!poll) {
            res.status(404).json({ message: 'Poll not found' });
            return;
        }
        if (!poll.comments) {
            poll.comments = [];
        }
        poll.comments.push({
            comment,
            userId: new mongoose_1.default.Types.ObjectId(userId), // ✅ Convert to ObjectId
            createdAt: new Date()
        });
        await poll.save();
        res.json({ message: 'Comment added', poll });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.addComment = addComment;
// @desc    Delete a poll (admin only)
// @route   DELETE /api/polls/:id
const deletePoll = async (req, res) => {
    try {
        const poll = await Poll_1.default.findById(req.params.id);
        if (!poll) {
            res.status(404).json({ message: 'Poll not found' });
            return;
        }
        await poll.deleteOne();
        res.json({ message: 'Poll deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.deletePoll = deletePoll;
// @desc    Delete all comments from a poll (admin only)
// @route   DELETE /api/polls/:id/comments
const deleteAllComments = async (req, res) => {
    try {
        const poll = await Poll_1.default.findById(req.params.id);
        if (!poll) {
            res.status(404).json({ message: 'Poll not found' });
            return;
        }
        poll.comments = [];
        await poll.save();
        res.json({ message: 'All comments deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.deleteAllComments = deleteAllComments;
// @desc    Delete a specific comment (admin only)
// @route   DELETE /api/polls/:id/comments/:commentId
const deleteComment = async (req, res) => {
    try {
        const poll = await Poll_1.default.findById(req.params.id);
        if (!poll) {
            res.status(404).json({ message: 'Poll not found' });
            return;
        }
        if (poll.comments && Array.isArray(poll.comments)) {
            poll.comments = poll.comments.filter((c) => c._id?.toString() !== req.params.commentId);
        }
        await poll.save();
        res.json({ message: 'Comment deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.deleteComment = deleteComment;
// @desc    Delete all polls (admin only)
// @route   DELETE /api/polls/all
const deleteAllPolls = async (req, res) => {
    try {
        await Poll_1.default.deleteMany({});
        res.json({ message: 'All polls deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.deleteAllPolls = deleteAllPolls;
