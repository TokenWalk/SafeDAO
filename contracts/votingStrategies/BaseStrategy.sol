// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity >=0.8.0;

import "../interfaces/IProposal.sol";

abstract contract BaseStrategy {
    /// @dev Emitted each time the avatar is set.
    event OwnerSet(address indexed previousOwner, address indexed newOwner);

    /// @dev Emitted each time the avatar is set.
    event SeeleSet(address indexed previousSeele, address indexed newSeele);

    address public seeleModule;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner may enter");
        _;
    }

    modifier onlySeele() {
        require(msg.sender == seeleModule, "only seele module may enter");
        _;
    }

    /// @dev Sets the executor to a new account (`newExecutor`).
    /// @notice Can only be called by the current owner.
    function setOwner(address _owner) public onlyOwner {
        address previousOwner = owner;
        owner = _owner;
        emit OwnerSet(previousOwner, _owner);
    }

    /// @dev Sets the executor to a new account (`newExecutor`).
    /// @notice Can only be called by the current owner.
    function setSeele(address _seele) public onlyOwner {
        address previousSeele = seeleModule;
        seeleModule = _seele;
        emit SeeleSet(previousSeele, _seele);
    }

    /// @dev Called by the proposal module, this notifes the strategy of a new proposal.
    /// @param data any extra data to pass to the voting strategy
    function receiveProposal(bytes memory data) external virtual;

    /// @dev Calls the proposal module to notify that a quorum has been reached.
    /// @param proposalId the proposal to vote for.
    function finalizeVote(uint256 proposalId) public virtual;

    /// @dev Determines if a proposal has succeeded.
    /// @param proposalId the proposal to vote for.
    /// @return boolean.
    function isPassed(uint256 proposalId) public view virtual returns (bool);
}