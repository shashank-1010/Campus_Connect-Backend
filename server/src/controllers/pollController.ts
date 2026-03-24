import { Request, Response } from 'express';
import Poll from '../models/Poll';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';

// @desc    Get all polls
// @route   GET /api/polls
export const getPolls = async (req: Request, res: Response): Promise<void> => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 });
    res.json(polls);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Create a poll
// @route   POST /api/polls
export const createPoll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { question, options } = req.body;
    
    const pollOptions = options.map((text: string) => ({
      text,
      votes: 0,
      voters: []
    }));

    const poll = await Poll.create({
      question,
      options: pollOptions,
      createdBy: req.userId,
      votedUsers: []
    });

    res.status(201).json(poll);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Vote on a poll (Allows vote change)
// @route   POST /api/polls/:id/vote
export const votePoll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { optionId } = req.body;
    const userId = req.userId as string;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      res.status(404).json({ message: 'Poll not found' });
      return;
    }

    // Find which option user previously voted for
    let previousVoteOptionIndex = -1;
    let previousVoteOption: any = null;
    
    for (let i = 0; i < poll.options.length; i++) {
      const opt = poll.options[i];
      if (opt.voters && opt.voters.some((id: any) => id.toString() === userId.toString())) {
        previousVoteOptionIndex = i;
        previousVoteOption = opt;
        break;
      }
    }
    
    // Find selected option
    const selectedOptionIndex = poll.options.findIndex((opt: any) => opt._id?.toString() === optionId);
    if (selectedOptionIndex === -1) {
      res.status(404).json({ message: 'Option not found' });
      return;
    }
    
    const selectedOption = poll.options[selectedOptionIndex];
    
    // If user already voted for this same option
    if (previousVoteOptionIndex === selectedOptionIndex) {
      res.status(400).json({ message: 'You have already voted for this option' });
      return;
    }
    
    // Remove previous vote if exists
    if (previousVoteOption) {
      previousVoteOption.votes -= 1;
      previousVoteOption.voters = previousVoteOption.voters.filter(
        (id: any) => id.toString() !== userId.toString()
      );
    }
    
    // Add new vote
    selectedOption.votes += 1;
    if (!selectedOption.voters) {
      selectedOption.voters = [];
    }
    selectedOption.voters.push(new mongoose.Types.ObjectId(userId));
    
    // Update poll's votedUsers list (ensure user is marked as voted)
    if (!poll.votedUsers) {
      poll.votedUsers = [];
    }
    if (!poll.votedUsers.some((id: any) => id.toString() === userId.toString())) {
      poll.votedUsers.push(new mongoose.Types.ObjectId(userId));
    }
    
    await poll.save();
    
    const message = previousVoteOption ? 'Vote changed successfully!' : 'Vote recorded successfully!';
    res.json({ message, poll });
    
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Add comment to poll
// @route   POST /api/polls/:id/comment
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { comment } = req.body;
    const userId = req.userId as string;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      res.status(404).json({ message: 'Poll not found' });
      return;
    }

    if (!poll.comments) {
      poll.comments = [];
    }

    poll.comments.push({
      comment,
      userId: new mongoose.Types.ObjectId(userId),
      createdAt: new Date()
    });

    await poll.save();
    res.json({ message: 'Comment added', poll });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Delete a poll (admin only)
// @route   DELETE /api/polls/:id
export const deletePoll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      res.status(404).json({ message: 'Poll not found' });
      return;
    }

    await poll.deleteOne();
    res.json({ message: 'Poll deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Delete all comments from a poll (admin only)
// @route   DELETE /api/polls/:id/comments
export const deleteAllComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      res.status(404).json({ message: 'Poll not found' });
      return;
    }

    poll.comments = [];
    await poll.save();
    res.json({ message: 'All comments deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Delete a specific comment (admin only)
// @route   DELETE /api/polls/:id/comments/:commentId
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      res.status(404).json({ message: 'Poll not found' });
      return;
    }

    if (poll.comments && Array.isArray(poll.comments)) {
      poll.comments = poll.comments.filter(
        (c: any) => c._id?.toString() !== req.params.commentId
      );
    }
    
    await poll.save();
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Delete all polls (admin only)
// @route   DELETE /api/polls/all
export const deleteAllPolls = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Poll.deleteMany({});
    res.json({ message: 'All polls deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
